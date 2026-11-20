import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DirectoryKind, Prisma, QuoteStatus } from "@prisma/client";
import { DirectoryService, directoryScope, pagination } from "../directory/directory.service";
import { PrismaService } from "../prisma";
import { recordAudit } from "../tenancy/audit";
import type { Tenant } from "../tenancy/tenant.guard";
import type { EditQuoteDto, QuoteDto, QuoteQuery } from "./dto";

const quoteDetail = {
  lines: { orderBy: { position: "asc" } },
  order: { select: { id: true } },
} satisfies Prisma.QuoteInclude;

const transitions: Record<QuoteStatus, readonly QuoteStatus[]> = {
  DRAFT: [QuoteStatus.SENT],
  SENT: [QuoteStatus.APPROVED, QuoteStatus.REJECTED],
  APPROVED: [],
  REJECTED: [],
};

@Injectable()
export class QuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: DirectoryService,
  ) {}

  async list(tenant: Tenant, query: QuoteQuery) {
    const where: Prisma.QuoteWhereInput = {
      organizationId: tenant.organizationId,
      status: query.status,
      OR: query.q
        ? [
            { title: { contains: query.q, mode: "insensitive" } },
            { customerName: { contains: query.q, mode: "insensitive" } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.quote.findMany({
          where,
          ...pagination(query),
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        this.prisma.quote.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, page: query.page, size: query.size };
  }

  async get(tenant: Tenant, id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { organizationId_id: { organizationId: tenant.organizationId, id } },
      include: quoteDetail,
    });
    if (!quote) throw new NotFoundException("Orçamento não encontrado.");
    return quote;
  }

  private async pricing(tx: Prisma.TransactionClient, tenant: Tenant, dto: QuoteDto) {
    const customer = await this.directory.find(tx, tenant, DirectoryKind.CUSTOMER, dto.customerId);
    const catalog = await tx.directoryRecord.findMany({
      where: {
        ...directoryScope(tenant.organizationId),
        kind: { in: [DirectoryKind.PRODUCT, DirectoryKind.SERVICE] },
        id: { in: dto.lines.map((line) => line.itemId) },
      },
      select: { id: true, name: true, kind: true, priceCents: true },
    });
    const byId = new Map(catalog.map((item) => [item.id, item]));
    let subtotalCents = 0;
    let discountCents = 0;
    const items = dto.lines.map((line, position) => {
      const item = byId.get(line.itemId);
      if (!item || item.priceCents == null)
        throw new NotFoundException("Produto ou serviço não encontrado.");
      const gross = item.priceCents * line.quantity;
      const discount = line.discountCents ?? 0;
      if (discount > gross) throw new BadRequestException("Desconto maior que o total do item.");
      subtotalCents += gross;
      discountCents += discount;
      return {
        position,
        itemId: item.id,
        label: item.name,
        kind: item.kind,
        quantity: line.quantity,
        unitPriceCents: item.priceCents,
        discountCents: discount,
        totalCents: gross - discount,
      };
    });
    if (subtotalCents > 2_000_000_000)
      throw new BadRequestException("Subtotal acima do limite do orçamento.");
    return {
      items,
      summary: {
        title: dto.name,
        customerId: customer.id,
        customerName: customer.name,
        subtotalCents,
        discountCents,
        totalCents: subtotalCents - discountCents,
      },
    };
  }

  create(tenant: Tenant, dto: QuoteDto) {
    return this.prisma.$transaction(async (tx) => {
      const { items, summary } = await this.pricing(tx, tenant, dto);
      const quote = await tx.quote.create({
        data: { ...summary, organizationId: tenant.organizationId },
      });
      await tx.quoteLine.createMany({
        data: items.map((line) => ({
          ...line,
          organizationId: tenant.organizationId,
          quoteId: quote.id,
        })),
      });
      await recordAudit(tx, tenant, {
        action: "quote.created",
        entity: "quote",
        entityId: quote.id,
      });
      return { ...quote, lines: items, order: null };
    });
  }

  edit(tenant: Tenant, id: string, dto: EditQuoteDto) {
    return this.prisma.$transaction(async (tx) => {
      const { items, summary } = await this.pricing(tx, tenant, dto);
      const organizationId = tenant.organizationId;
      const [quote] = await tx.quote.updateManyAndReturn({
        where: { organizationId, id, revision: dto.revision, status: QuoteStatus.DRAFT },
        data: { ...summary, revision: { increment: 1 } },
      });
      if (!quote) {
        if (
          !(await tx.quote.findUnique({
            where: { organizationId_id: { organizationId, id } },
            select: { id: true },
          }))
        )
          throw new NotFoundException("Orçamento não encontrado.");
        throw new ConflictException("O rascunho mudou. Recarregue o orçamento.");
      }
      await tx.quoteLine.deleteMany({ where: { organizationId, quoteId: id } });
      await tx.quoteLine.createMany({
        data: items.map((line) => ({ ...line, organizationId, quoteId: id })),
      });
      await recordAudit(tx, tenant, { action: "quote.updated", entity: "quote", entityId: id });
      return { ...quote, lines: items, order: null };
    });
  }

  changeStatus(tenant: Tenant, id: string, next: QuoteStatus) {
    return this.prisma.$transaction(async (tx) => {
      const organizationId = tenant.organizationId;
      const quote = await tx.quote.findUnique({
        where: { organizationId_id: { organizationId, id } },
      });
      if (!quote) throw new NotFoundException("Orçamento não encontrado.");
      if (quote.status === next) return quote;
      if (!transitions[quote.status].includes(next))
        throw new ConflictException("Transição de status inválida.");
      const [updated] = await tx.quote.updateManyAndReturn({
        where: { organizationId, id, status: quote.status, revision: quote.revision },
        data: { status: next, revision: { increment: 1 } },
      });
      if (!updated) throw new ConflictException("O orçamento mudou. Recarregue e tente novamente.");
      await recordAudit(tx, tenant, {
        action: "quote.status_changed",
        entity: "quote",
        entityId: id,
        details: { from: quote.status, to: next },
      });
      return updated;
    });
  }

  async convert(tenant: Tenant, id: string) {
    if (!tenant.settings.ordersEnabled)
      throw new ForbiddenException("Módulo de ordens desabilitado.");
    const organizationId = tenant.organizationId;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const quote = await tx.quote.findUnique({
          where: { organizationId_id: { organizationId, id } },
        });
        if (!quote) throw new NotFoundException("Orçamento não encontrado.");
        if (quote.status !== QuoteStatus.APPROVED)
          throw new ConflictException("Aprove o orçamento antes de convertê-lo.");
        const order = await tx.workOrder.findUnique({
          where: { organizationId_quoteId: { organizationId, quoteId: id } },
        });
        if (order) return order;
        const created = await tx.workOrder.create({
          data: {
            organizationId,
            quoteId: id,
            customerId: quote.customerId,
            title: quote.title,
            createdBy: tenant.userId,
          },
        });
        await recordAudit(tx, tenant, {
          action: "quote.converted",
          entity: "quote",
          entityId: id,
          details: { workOrderId: created.id },
        });
        await recordAudit(tx, tenant, {
          action: "order.from_quote",
          entity: "work_order",
          entityId: created.id,
          details: { quoteId: id },
        });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const order = await this.prisma.workOrder.findUnique({
          where: { organizationId_quoteId: { organizationId, quoteId: id } },
        });
        if (order) return order;
      }
      throw error;
    }
  }
}
