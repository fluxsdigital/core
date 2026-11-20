import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";

import { PrismaService } from "../prisma";
import { AuthGuard, CurrentIdentity, type Identity } from "./auth.guard";
import { accessLifetime, AuthService, publicUser } from "./auth.service";
import {
  ChangePasswordDto,
  EmailDto,
  LoginDto,
  NameDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto";
import { MailService } from "./mail.service";

function cookie(path: string): CookieOptions {
  return {
    path,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  };
}

function setSession(response: Response, session: Awaited<ReturnType<AuthService["login"]>>) {
  response.cookie("flux_access", session.access, {
    ...cookie("/api/v1"),
    maxAge: accessLifetime * 1000,
  });
  response.cookie("flux_refresh", session.refresh, {
    ...cookie("/api/v1/auth"),
    maxAge: Math.max(0, session.expiresAt.getTime() - Date.now()),
  });
}

function clearSession(response: Response) {
  response.clearCookie("flux_access", cookie("/api/v1"));
  response.clearCookie("flux_refresh", cookie("/api/v1/auth"));
}

@ApiTags("Autenticação")
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("register")
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  @HttpCode(204)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    setSession(response, await this.auth.login(dto));
  }

  @Post("refresh")
  @HttpCode(204)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = request.cookies.flux_refresh as unknown;
    if (typeof token !== "string") throw new UnauthorizedException();
    setSession(response, await this.auth.refresh(token));
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refresh = request.cookies.flux_refresh as unknown;
    const access = request.cookies.flux_access as unknown;
    const session =
      typeof access === "string"
        ? await this.auth.validate(access).catch((error: unknown) => {
            if (!(error instanceof UnauthorizedException)) throw error;
            return undefined;
          })
        : undefined;
    await this.auth.logout(typeof refresh === "string" ? refresh : undefined, session?.id);
    clearSession(response);
  }

  @Post("forgot-password")
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: EmailDto) {
    void this.sendPasswordReset(dto.email);
  }

  private async sendPasswordReset(email: string) {
    try {
      const token = await this.auth.createPasswordReset(email);
      if (token) await this.mail.sendReset(email, token);
    } catch {
      this.logger.warn("Falha ao solicitar recuperação de senha.");
    }
  }

  @Post("reset-password")
  @HttpCode(204)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.resetPassword(dto.token, dto.password);
    clearSession(response);
  }

  @Post("change-password")
  @HttpCode(204)
  @ApiCookieAuth()
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async changePassword(
    @CurrentIdentity() identity: Identity,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.changePassword(identity.userId, dto.currentPassword, dto.password);
    clearSession(response);
  }

  @Get("me")
  @ApiCookieAuth()
  @UseGuards(AuthGuard)
  me(@CurrentIdentity() identity: Identity) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: identity.userId },
      select: publicUser,
    });
  }

  @Patch("me")
  @ApiCookieAuth()
  @UseGuards(AuthGuard)
  updateProfile(@CurrentIdentity() identity: Identity, @Body() dto: NameDto) {
    return this.prisma.user.update({
      where: { id: identity.userId },
      data: { name: dto.name },
      select: publicUser,
    });
  }

  @Get("sessions")
  @ApiCookieAuth()
  @UseGuards(AuthGuard)
  async sessions(@CurrentIdentity() identity: Identity) {
    const active = await this.prisma.session.findMany({
      where: { userId: identity.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    });
    return active.map((session) => ({ ...session, current: session.id === identity.id }));
  }

  @Post("sessions/:id/revoke")
  @HttpCode(204)
  @ApiCookieAuth()
  @UseGuards(AuthGuard)
  async revoke(@CurrentIdentity() identity: Identity, @Param("id", ParseUUIDPipe) id: string) {
    await this.prisma.session.updateMany({
      where: { id, userId: identity.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
