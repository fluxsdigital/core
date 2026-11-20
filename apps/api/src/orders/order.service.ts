import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DirectoryKind, Prisma, Role } from "@prisma/client";

import { DirectoryService, pagination } from "../directory/directory.service";
import { attachmentMaxBytes, type UploadedAttachment } from "../directory/documents.service";
import { PrismaService } from "../prisma";
import { recordAudit } from "../tenancy/audit";
import type { Tenant } from "../tenancy/tenant.guard";
import type { MoveOrderDto, OrderDto, OrderQuery, OrderSettingsDto, StatusUpdate } from "./dto";

const summary = {
  status: true,
  customer: { select: { name: true } },
  assignee: { select: { user: { select: { name: true } } } },
} satisfies Prisma.WorkOrderInclude;

const attachmentSummary = { id: true, name: true, size: true, createdAt: true } as const;
const workKind = "work_order";

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: DirectoryService,
  ) {}

  async list(tenant: Tenant, query: OrderQuery) {
    const where: Prisma.WorkOrderWhereInput = {
      organizationId: tenant.organizationId,
      statusKey: query.status,
      priority: query.priority,
      OR: query.q
        ? [
            { title: { contains: query.q, mode: "insensitive" } },
            { customer: { name: { contains: query.q, mode: "insensitive" } } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.workOrder.findMany({
          where,
          ...pagination(query),
          include: summary,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        this.prisma.workOrder.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, page: query.page, size: query.size };
  }

  async get(tenant: Tenant, id: string) {
    const organizationId = tenant.organizationId;
    const [order, history] = await this.prisma.$transaction(
      [
        this.prisma.workOrder.findUnique({
          where: { organizationId_id: { organizationId, id } },
          include: {
            ...summary,
            tasks: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
            attachments: {
              select: attachmentSummary,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            },
          },
        }),
        this.prisma.auditEvent.findMany({
          where: { organizationId, entity: workKind, entityId: id },
          take: 100,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, action: true, actorId: true, createdAt: true, details: true },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    if (!order) throw new NotFoundException("Ordem de serviço não encontrada.");
    return { ...order, history };
  }

  statuses(tenant: Tenant) {
    return this.prisma.workStatus.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: [{ terminal: "asc" }, { label: "asc" }],
    });
  }

  async setStatus(tenant: Tenant, dto: StatusUpdate, key?: string) {
    const organizationId = tenant.organizationId;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const [status] = key
          ? await tx.workStatus.updateManyAndReturn({
              where: { organizationId, key },
              data: { label: dto.name },
            })
          : [
              await tx.workStatus.create({
                data: { organizationId, label: dto.name, terminal: dto.terminal },
              }),
            ];
        if (!status) throw new NotFoundException("Status não encontrado.");
        await recordAudit(tx, tenant, {
          action: key ? "work_status.renamed" : "work_status.created",
          entity: "organization",
          entityId: organizationId,
          details: { key: status.key, label: status.label },
        });
        return status;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("Já existe um status com esse nome.");
      throw error;
    }
  }

  private async settings(tx: Prisma.TransactionClient, tenant: Tenant, dto: OrderSettingsDto) {
    if (
      dto.assignedUserId &&
      !(await tx.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: tenant.organizationId,
            userId: dto.assignedUserId,
          },
        },
        select: { userId: true },
      }))
    )
      throw new NotFoundException("Responsável não encontrado na empresa.");
    return {
      title: dto.name,
      priority: dto.priority,
      assignedUserId: dto.assignedUserId || null,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
    };
  }

  private async lockOpen(tx: Prisma.TransactionClient, tenant: Tenant, id: string) {
    const organizationId = tenant.organizationId;
    const ids = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "WorkOrder" WHERE "organizationId" = ${organizationId}::uuid AND id = ${id}::uuid FOR UPDATE
    `;
    if (!ids.length) throw new NotFoundException("Ordem de serviço não encontrada.");
    const order = await tx.workOrder.findUniqueOrThrow({
      where: { organizationId_id: { organizationId, id } },
      include: { status: true },
    });
    if (tenant.role === Role.OPERATOR && order.assignedUserId !== tenant.userId) {
      throw new ForbiddenException("A ordem está atribuída a outro responsável.");
    }
    if (order.status.terminal) throw new ConflictException("A ordem de serviço já está concluída.");
    return order;
  }

  create(tenant: Tenant, dto: OrderDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.directory.lockActive(tx, tenant, DirectoryKind.CUSTOMER, dto.customerId);
      const values = await this.settings(tx, tenant, dto);
      const order = await tx.workOrder.create({
        data: {
          ...values,
          organizationId: tenant.organizationId,
          customerId: dto.customerId,
          createdBy: tenant.userId,
        },
      });
      await recordAudit(tx, tenant, {
        action: "order.created",
        entity: workKind,
        entityId: order.id,
      });
      return order;
    });
  }

  update(tenant: Tenant, id: string, dto: OrderSettingsDto) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await this.lockOpen(tx, tenant, id);
      const data = await this.settings(tx, tenant, dto);
      const order = await tx.workOrder.update({
        where: { organizationId_id: { organizationId: tenant.organizationId, id } },
        data,
      });
      await recordAudit(tx, tenant, {
        action: "order.updated",
        entity: workKind,
        entityId: id,
        details: {
          from: {
            title: previous.title,
            priority: previous.priority,
            assignedUserId: previous.assignedUserId,
            dueAt: previous.dueAt?.toISOString() ?? null,
          },
          to: { ...data, dueAt: data.dueAt?.toISOString() ?? null },
        },
      });
      return order;
    });
  }

  move(tenant: Tenant, id: string, dto: MoveOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.lockOpen(tx, tenant, id);
      const organizationId = tenant.organizationId;
      const next = await tx.workStatus.findUnique({
        where: { organizationId_key: { organizationId, key: dto.status } },
      });
      if (!next) throw new NotFoundException("Status não encontrado.");
      if (order.statusKey === next.key) return order;
      if (next.terminal) {
        if (!dto.report) throw new BadRequestException("Informe o relatório de conclusão.");
        if (await tx.workTask.count({ where: { organizationId, orderId: id, done: false } })) {
          throw new ConflictException("Conclua os itens do checklist.");
        }
      }
      const moved = await tx.workOrder.update({
        where: { organizationId_id: { organizationId, id } },
        data: {
          statusKey: next.key,
          completedAt: next.terminal ? new Date() : null,
          completionReport: next.terminal ? dto.report : null,
        },
      });
      await recordAudit(tx, tenant, {
        action: "order.status_changed",
        entity: workKind,
        entityId: id,
        details: { from: order.status.label, to: next.label },
      });
      return moved;
    });
  }

  addTask(tenant: Tenant, id: string, label: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, tenant, id);
      const organizationId = tenant.organizationId;
      if ((await tx.workTask.count({ where: { organizationId, orderId: id } })) >= 100)
        throw new ConflictException("Limite de itens no checklist atingido.");
      const task = await tx.workTask.create({ data: { organizationId, orderId: id, label } });
      await recordAudit(tx, tenant, {
        action: "order.task_added",
        entity: workKind,
        entityId: id,
        details: { task: task.label },
      });
      return task;
    });
  }

  check(tenant: Tenant, id: string, taskId: string, done: boolean) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, tenant, id);
      const [task] = await tx.workTask.updateManyAndReturn({
        where: { organizationId: tenant.organizationId, orderId: id, id: taskId },
        data: { done },
      });
      if (!task) throw new NotFoundException("Item do checklist não encontrado.");
      await recordAudit(tx, tenant, {
        action: "order.task_checked",
        entity: workKind,
        entityId: id,
        details: { task: task.label, done },
      });
      return task;
    });
  }

  upload(tenant: Tenant, id: string, file?: UploadedAttachment) {
    if (!file?.size || file.size > attachmentMaxBytes)
      throw new BadRequestException("Selecione um arquivo de até 5 MB.");
    const name =
      [...file.originalname]
        .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
        .slice(0, 150)
        .join("")
        .trim() || "anexo";
    return this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, tenant, id);
      const organizationId = tenant.organizationId;
      if ((await tx.workAttachment.count({ where: { organizationId, orderId: id } })) >= 30)
        throw new ConflictException("Limite de anexos atingido.");
      const attachment = await tx.workAttachment.create({
        data: {
          organizationId,
          orderId: id,
          name,
          size: file.size,
          data: Uint8Array.from(file.buffer),
        },
        select: attachmentSummary,
      });
      await recordAudit(tx, tenant, {
        action: "order.attachment_added",
        entity: workKind,
        entityId: id,
        details: { attachmentId: attachment.id, name },
      });
      return attachment;
    });
  }

  async attachment(tenant: Tenant, id: string, attachmentId: string) {
    const attachment = await this.prisma.workAttachment.findFirst({
      where: { organizationId: tenant.organizationId, orderId: id, id: attachmentId },
      select: { data: true, name: true },
    });
    if (!attachment) throw new NotFoundException("Anexo não encontrado.");
    return attachment;
  }
}
