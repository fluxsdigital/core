import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DirectoryKind, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma";
import { recordAudit } from "../tenancy/audit";
import type { Tenant } from "../tenancy/tenant.guard";
import type { DirectoryDto, DirectoryQuery } from "./dto";

export const directoryScope = (organizationId: string) => ({ organizationId, archivedAt: null });

export function pagination({ page, size }: DirectoryQuery) {
  return { skip: (page - 1) * size, take: size };
}

@Injectable()
export class DirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenant: Tenant, kind: DirectoryKind, query: DirectoryQuery) {
    const where: Prisma.DirectoryRecordWhereInput = {
      ...directoryScope(tenant.organizationId),
      kind,
      parentId: query.parentId,
      OR: query.q
        ? [
            { name: { contains: query.q, mode: "insensitive" } },
            { code: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.directoryRecord.findMany({
          where,
          ...pagination(query),
          orderBy: [{ name: "asc" }, { id: "asc" }],
        }),
        this.prisma.directoryRecord.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, page: query.page, size: query.size };
  }

  async find(tx: Prisma.TransactionClient, tenant: Tenant, kind: DirectoryKind, id: string) {
    const item = await tx.directoryRecord.findFirst({
      where: { ...directoryScope(tenant.organizationId), kind, id },
    });
    if (!item) throw new NotFoundException("Registro não encontrado.");
    return item;
  }

  async lockActive(tx: Prisma.TransactionClient, tenant: Tenant, kind: DirectoryKind, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "DirectoryRecord"
      WHERE "organizationId" = ${tenant.organizationId}::uuid AND id = ${id}::uuid
        AND kind = ${kind}::"DirectoryKind" AND "archivedAt" IS NULL
      FOR UPDATE
    `;
    if (!rows.length) throw new NotFoundException("Registro não encontrado.");
  }

  private async input(
    tx: Prisma.TransactionClient,
    tenant: Tenant,
    kind: DirectoryKind,
    dto: DirectoryDto,
  ) {
    const person = kind === DirectoryKind.CUSTOMER || kind === DirectoryKind.CONTACT;
    const catalog = kind === DirectoryKind.PRODUCT || kind === DirectoryKind.SERVICE;
    const parentKind =
      kind === DirectoryKind.CONTACT
        ? DirectoryKind.CUSTOMER
        : catalog
          ? DirectoryKind.CATEGORY
          : null;
    if (
      (!person && (dto.email || dto.phone)) ||
      (!catalog && (dto.code || dto.priceCents != null)) ||
      (!parentKind && dto.parentId)
    ) {
      throw new BadRequestException("Os campos enviados não pertencem ao tipo de cadastro.");
    }
    if ((catalog && dto.priceCents == null) || (kind === DirectoryKind.CONTACT && !dto.parentId)) {
      throw new BadRequestException(catalog ? "Informe o preço." : "Informe o cliente do contato.");
    }
    if (parentKind && dto.parentId) await this.lockActive(tx, tenant, parentKind, dto.parentId);
    return {
      name: dto.name,
      description: dto.description || null,
      email: dto.email || null,
      phone: dto.phone || null,
      code: dto.code || null,
      priceCents: dto.priceCents ?? null,
      parentId: dto.parentId || null,
    };
  }

  create(tenant: Tenant, kind: DirectoryKind, dto: DirectoryDto) {
    return this.prisma.$transaction(async (tx) => {
      const data = await this.input(tx, tenant, kind, dto);
      const item = await tx.directoryRecord.create({
        data: { ...data, kind, organizationId: tenant.organizationId },
      });
      await recordAudit(tx, tenant, {
        action: "directory.created",
        entity: kind,
        entityId: item.id,
      });
      return item;
    });
  }

  async edit(tenant: Tenant, kind: DirectoryKind, id: string, dto: DirectoryDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const data = await this.input(tx, tenant, kind, dto);
        const item = await tx.directoryRecord.update({
          where: {
            organizationId_id: { organizationId: tenant.organizationId, id },
            kind,
            archivedAt: null,
          },
          data,
        });
        await recordAudit(tx, tenant, { action: "directory.updated", entity: kind, entityId: id });
        return item;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")
        throw new NotFoundException("Registro não encontrado.");
      throw error;
    }
  }

  async archive(tenant: Tenant, kind: DirectoryKind, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockActive(tx, tenant, kind, id);
      const children = await tx.directoryRecord.count({
        where: { ...directoryScope(tenant.organizationId), parentId: id },
      });
      if (children > 0)
        throw new ConflictException("Arquive ou mova primeiro os registros vinculados.");
      const result = await tx.directoryRecord.updateMany({
        where: { ...directoryScope(tenant.organizationId), kind, id },
        data: { archivedAt: new Date() },
      });
      if (result.count)
        await recordAudit(tx, tenant, { action: "directory.archived", entity: kind, entityId: id });
    });
  }
}
