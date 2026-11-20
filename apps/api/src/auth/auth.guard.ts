import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

import { AuthService } from "./auth.service";

export type Identity = { id: string; userId: string };

export type AuthRequest = Request & { identity: Identity };

export const CurrentIdentity = createParamDecorator((_: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<AuthRequest>().identity;
});

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.cookies.flux_access as unknown;
    if (typeof token !== "string") throw new UnauthorizedException();
    request.identity = await this.auth.validate(token);
    return true;
  }
}
