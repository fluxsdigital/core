import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { type DirectoryKind, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma";
import { recordAudit } from "../tenancy/audit";
import type { Tenant } from "../tenancy/tenant.guard";
import { DirectoryService, directoryScope, pagination } from "./directory.service";
import type { ListQuery } from "./dto";

export const attachmentMaxBytes = 5 * 1024 * 1024;
export type UploadedAttachment = { originalname: string; buffer: Buffer; size: number };
const attachmentSummary = {
  id: true,
  name: true,
  size: true,
  createdAt: true,
  authorId: true,
} as const;
const newestFirst = [{ createdAt: "desc" }, { id: "desc" }] as const;

@Injectable()
export class DirectoryDocuments {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: DirectoryService,
  ) {}

  async notes(tenant: Tenant, kind: DirectoryKind, recordId: string, query: ListQuery) {
    const where: Prisma.DirectoryNoteWhereInput = {
      ...directoryScope(tenant.organizationId),
      recordId,
      record: { kind, archivedAt: null },
      content: query.q ? { contains: query.q, mode: "insensitive" } : undefined,
    };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.directoryNote.findMany({
          where,
          ...pagination(query),
          orderBy: [...newestFirst],
        }),
        this.prisma.directoryNote.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, page: query.page, size: query.size };
  }

  writeNote(tenant: Tenant, kind: DirectoryKind, recordId: string, content: string, id?: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.directory.lockActive(tx, tenant, kind, recordId);
      const notFound = new NotFoundException("Observação não encontrada.");
      const filter = { ...directoryScope(tenant.organizationId), recordId, id };
      if (id && !(await tx.directoryNote.findFirst({ where: filter, select: { id: true } })))
        throw notFound;
      const note = id
        ? await tx.directoryNote.update({
            where: { organizationId_id: { organizationId: tenant.organizationId, id } },
            data: { content },
          })
        : await tx.directoryNote.create({
            data: {
              organizationId: tenant.organizationId,
              recordId,
              content,
              authorId: tenant.userId,
            },
          });
      await recordAudit(tx, tenant, {
        action: id ? "note.updated" : "note.created",
        entity: "note",
        entityId: note.id,
        details: { recordId },
      });
      return note;
    });
  }

  async attachments(tenant: Tenant, kind: DirectoryKind, recordId: string, query: ListQuery) {
    const where: Prisma.DirectoryAttachmentWhereInput = {
      ...directoryScope(tenant.organizationId),
      recordId,
      record: { kind, archivedAt: null },
      name: query.q ? { contains: query.q, mode: "insensitive" } : undefined,
    };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.directoryAttachment.findMany({
          where,
          ...pagination(query),
          select: attachmentSummary,
          orderBy: [...newestFirst],
        }),
        this.prisma.directoryAttachment.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, page: query.page, size: query.size };
  }

  upload(tenant: Tenant, kind: DirectoryKind, recordId: string, file?: UploadedAttachment) {
    if (!file?.size || file.size > attachmentMaxBytes)
      throw new BadRequestException("Selecione um arquivo de até 5 MB.");
    const safeChars = [...file.originalname].filter(
      (char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127,
    );
    const name = safeChars.slice(0, 150).join("").trim() || "anexo";
    return this.prisma.$transaction(async (tx) => {
      await this.directory.lockActive(tx, tenant, kind, recordId);
      const attachment = await tx.directoryAttachment.create({
        data: {
          organizationId: tenant.organizationId,
          recordId,
          name,
          mediaType: "application/octet-stream",
          size: file.size,
          data: Uint8Array.from(file.buffer),
          authorId: tenant.userId,
        },
        select: attachmentSummary,
      });
      await recordAudit(tx, tenant, {
        action: "attachment.uploaded",
        entity: "attachment",
        entityId: attachment.id,
        details: { recordId },
      });
      return attachment;
    });
  }

  async download(tenant: Tenant, kind: DirectoryKind, recordId: string, id: string) {
    const attachment = await this.prisma.directoryAttachment.findFirst({
      where: {
        ...directoryScope(tenant.organizationId),
        recordId,
        id,
        record: { kind, archivedAt: null },
      },
      select: { name: true, mediaType: true, data: true },
    });
    if (!attachment) throw new NotFoundException("Anexo não encontrado.");
    return attachment;
  }

  rename(tenant: Tenant, kind: DirectoryKind, recordId: string, id: string, name: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.directory.lockActive(tx, tenant, kind, recordId);
      const [attachment] = await tx.directoryAttachment.updateManyAndReturn({
        where: { ...directoryScope(tenant.organizationId), recordId, id },
        data: { name },
        select: attachmentSummary,
      });
      if (!attachment) throw new NotFoundException("Anexo não encontrado.");
      await recordAudit(tx, tenant, {
        action: "attachment.renamed",
        entity: "attachment",
        entityId: id,
        details: { recordId },
      });
      return attachment;
    });
  }

  async archive(
    tenant: Tenant,
    kind: DirectoryKind,
    recordId: string,
    id: string,
    type: "note" | "attachment",
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.directory.lockActive(tx, tenant, kind, recordId);
      const where = { ...directoryScope(tenant.organizationId), recordId, id };
      const data = { archivedAt: new Date() };
      const result =
        type === "note"
          ? await tx.directoryNote.updateMany({ where, data })
          : await tx.directoryAttachment.updateMany({ where, data });
      if (!result.count) throw new NotFoundException("Registro complementar não encontrado.");
      await recordAudit(tx, tenant, {
        action: `${type}.archived`,
        entity: type,
        entityId: id,
        details: { recordId },
      });
    });
  }
}
