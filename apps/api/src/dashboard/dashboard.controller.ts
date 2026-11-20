import { BadRequestException, Body, Controller, Get, Put, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import { Prisma, QuoteStatus } from "@prisma/client";

import { AuthGuard } from "../auth/auth.guard";
import { PrismaService } from "../prisma";
import { recordAudit } from "../tenancy/audit";
import { publicSettings } from "../tenancy/features";
import { Permission } from "../tenancy/permissions";
import {
  CurrentTenant,
  RequirePermission,
  type Tenant,
  TenantGuard,
} from "../tenancy/tenant.guard";
import { DashboardQuery, SettingsDto } from "./dto";

@ApiTags("Relatórios e configurações")
@ApiCookieAuth()
@ApiParam({ name: "organizationId", format: "uuid" })
@UseGuards(AuthGuard, TenantGuard)
@Controller("organizations/:organizationId")
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("settings")
  @RequirePermission(Permission.CompanyRead)
  readSettings(@CurrentTenant() tenant: Tenant) {
    return tenant.settings;
  }

  @Put("settings")
  @RequirePermission(Permission.CompanyWrite)
  updateSettings(@CurrentTenant() tenant: Tenant, @Body() dto: SettingsDto) {
    if (!dto.directoryEnabled && (dto.quotesEnabled || dto.ordersEnabled)) {
      throw new BadRequestException("Orçamentos e ordens dependem do módulo de cadastros.");
    }
    const values = {
      ...dto,
      displayName: dto.displayName ?? null,
      accentColor: dto.accentColor.toLowerCase(),
    };
    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.organizationSettings.upsert({
        where: { organizationId: tenant.organizationId },
        create: { organizationId: tenant.organizationId, ...values },
        update: values,
      });
      await recordAudit(tx, tenant, {
        action: "company.settings_updated",
        entity: "organization",
        entityId: tenant.organizationId,
        details: publicSettings(settings),
      });
      return publicSettings(settings);
    });
  }

  @Get("dashboard")
  @RequirePermission(Permission.CompanyRead)
  get(@CurrentTenant() tenant: Tenant, @Query() query: DashboardQuery) {
    const organizationId = tenant.organizationId;
    const now = new Date();
    const range = {
      gte: query.from ? new Date(query.from) : undefined,
      lt: query.to ? new Date(query.to) : undefined,
    };
    if (range.gte && range.lt && range.gte >= range.lt)
      throw new BadRequestException("O fim precisa ser posterior ao início.");
    return this.prisma.$transaction(
      async (tx) => {
        const quotes = tenant.settings.quotesEnabled
          ? await tx.quote.groupBy({
              by: ["status"],
              where: { organizationId, createdAt: range },
              _count: { _all: true },
              _sum: { totalCents: true },
            })
          : null;
        const open = { organizationId, status: { terminal: false }, createdAt: range };
        const orders = tenant.settings.ordersEnabled
          ? {
              open: await tx.workOrder.count({ where: open }),
              completed: await tx.workOrder.count({
                where: {
                  organizationId,
                  completedAt: { ...range, not: null },
                  status: { terminal: true },
                },
              }),
              overdue: await tx.workOrder.count({ where: { ...open, dueAt: { lt: now } } }),
              pendingTasks: await tx.workTask.count({
                where: { organizationId, done: false, order: open },
              }),
              deadlines: await tx.workOrder.findMany({
                where: { ...open, dueAt: { not: null } },
                orderBy: [{ dueAt: "asc" }, { id: "asc" }],
                take: 12,
                select: {
                  id: true,
                  title: true,
                  dueAt: true,
                  priority: true,
                  status: { select: { label: true } },
                  _count: { select: { tasks: { where: { done: false } } } },
                },
              }),
            }
          : null;
        return {
          quotes:
            quotes &&
            Object.values(QuoteStatus).map((status) => {
              const row = quotes.find((quote) => quote.status === status);
              return {
                status,
                count: row?._count._all ?? 0,
                totalCents: row?._sum.totalCents ?? 0,
              };
            }),
          orders,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
