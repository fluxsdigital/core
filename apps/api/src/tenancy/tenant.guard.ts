import {
  BadRequestException,
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@prisma/client";
import { isUUID } from "class-validator";

import type { AuthRequest } from "../auth/auth.guard";
import { PrismaService } from "../prisma";
import { enabled, publicSettings, type Settings } from "./features";
import { allows, type Permission } from "./permissions";

const requiredPermission = Symbol("tenantPermission");

export type Tenant = {
  organizationId: string;
  userId: string;
  role: Role;
  settings: Settings;
};

type TenantRequest = AuthRequest & { tenant?: Tenant };

export const RequirePermission = (permission: Permission) =>
  SetMetadata(requiredPermission, permission);

export const CurrentTenant = createParamDecorator((_: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<TenantRequest>().tenant;
});

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const { organizationId } = request.params;
    const permission = this.reflector.getAllAndOverride<Permission>(requiredPermission, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission || !request.identity) throw new ForbiddenException();
    if (typeof organizationId !== "string" || !isUUID(organizationId, "4")) {
      throw new BadRequestException("Identificador de empresa inválido.");
    }
    const userId = request.identity.userId;
    const member = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { organizationId: true, role: true, organization: { select: { settings: true } } },
    });
    if (!member) throw new NotFoundException("Empresa não encontrada.");
    if (!allows(member.role, permission)) throw new ForbiddenException("Permissão insuficiente.");
    const settings = publicSettings(member.organization.settings);
    if (!enabled(settings, permission))
      throw new ForbiddenException("Módulo desabilitado para esta empresa.");
    request.tenant = { organizationId: member.organizationId, userId, role: member.role, settings };

    return true;
  }
}
