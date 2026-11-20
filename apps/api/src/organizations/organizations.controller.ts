import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiParam, ApiProperty, ApiTags } from "@nestjs/swagger";
import { Prisma, Role } from "@prisma/client";
import { IsEnum, IsUUID, NotEquals } from "class-validator";

import { AuthGuard, CurrentIdentity, type Identity } from "../auth/auth.guard";
import { publicUser } from "../auth/auth.service";
import { NameDto } from "../auth/dto";
import { defaultWorkStatuses } from "../orders/default-statuses";
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

class AddMemberDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  userId!: string;

  @ApiProperty({ enum: [Role.ADMIN, Role.MANAGER, Role.OPERATOR] })
  @IsEnum(Role)
  @NotEquals(Role.OWNER)
  role!: Exclude<Role, "OWNER">;
}

@ApiTags("Empresas")
@ApiCookieAuth()
@UseGuards(AuthGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentIdentity() { userId }: Identity) {
    const associations = await this.prisma.membership.findMany({
      where: { userId },
      select: { organization: { include: { settings: true } }, role: true },
      orderBy: [{ organization: { name: "asc" } }, { organizationId: "asc" }],
    });
    return associations.map(({ organization, role }) => ({
      ...organization,
      role,
      settings: publicSettings(organization.settings),
    }));
  }

  @Post()
  create(@CurrentIdentity() { userId }: Identity, @Body() dto: NameDto) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.organization.create({
        data: {
          name: dto.name,
          members: { create: { userId, role: Role.OWNER } },
          workStatuses: { createMany: { data: defaultWorkStatuses } },
        },
      });
      await recordAudit(
        tx,
        { organizationId: company.id, userId },
        {
          action: "company.created",
          entity: "organization",
          entityId: company.id,
        },
      );
      return company;
    });
  }
}

@ApiTags("Empresas")
@ApiCookieAuth()
@ApiParam({ name: "organizationId", format: "uuid" })
@UseGuards(AuthGuard, TenantGuard)
@Controller("organizations/:organizationId")
export class CompanyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission(Permission.CompanyRead)
  async read(@CurrentTenant() tenant: Tenant) {
    const company = await this.prisma.organization.findUnique({
      where: { id: tenant.organizationId },
    });
    if (!company) throw new NotFoundException();
    return { ...company, role: tenant.role };
  }

  @Patch()
  @RequirePermission(Permission.CompanyWrite)
  update(@CurrentTenant() tenant: Tenant, @Body() dto: NameDto) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.organization.update({
        where: { id: tenant.organizationId },
        data: { name: dto.name },
      });
      await recordAudit(tx, tenant, {
        action: "company.updated",
        entity: "organization",
        entityId: company.id,
      });
      return company;
    });
  }

  @Get("members")
  @RequirePermission(Permission.MembersRead)
  members(@CurrentTenant() tenant: Tenant) {
    return this.prisma.membership.findMany({
      where: { organizationId: tenant.organizationId },
      select: { role: true, user: { select: publicUser } },
      orderBy: [{ user: { name: "asc" } }, { userId: "asc" }],
    });
  }

  @Post("members")
  @RequirePermission(Permission.MembersWrite)
  async addMember(@CurrentTenant() tenant: Tenant, @Body() dto: AddMemberDto) {
    if (dto.role === Role.ADMIN && tenant.role !== Role.OWNER) throw new ForbiddenException();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const association = await tx.membership.create({
          data: { organizationId: tenant.organizationId, userId: dto.userId, role: dto.role },
          select: { role: true, user: { select: publicUser } },
        });
        await recordAudit(tx, tenant, {
          action: "member.added",
          entity: "user",
          entityId: dto.userId,
          details: { role: dto.role },
        });
        return association;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002")
          throw new ConflictException("A conta já está associada à empresa.");
        if (error.code === "P2003") throw new NotFoundException("Conta não encontrada.");
      }
      throw error;
    }
  }

  @Get("audit")
  @RequirePermission(Permission.AuditRead)
  audit(@CurrentTenant() tenant: Tenant) {
    return this.prisma.auditEvent.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }
}
