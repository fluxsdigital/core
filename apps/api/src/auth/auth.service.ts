import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma, type Session } from "@prisma/client";
import { PrismaService } from "../prisma";
import { hashPassword, matchesPassword, randomToken, tokenHash } from "./credentials";
import type { LoginDto, RegisterDto } from "./dto";

export const accessLifetime = 10 * 60;
export const refreshLifetime = 14 * 24 * 60 * 60 * 1000;
const resetLifetime = 30 * 60 * 1000;
export const publicUser = { id: true, email: true, name: true } as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private async issue(session: Session, refresh: string) {
    const access = await this.jwt.signAsync({ sub: session.userId, sid: session.id });
    return { access, refresh, expiresAt: session.expiresAt };
  }

  async register(dto: RegisterDto) {
    const passwordHash = await hashPassword(dto.password);
    try {
      return await this.prisma.user.create({
        data: { email: dto.email, name: dto.name, passwordHash },
        select: publicUser,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Não foi possível cadastrar essa conta.");
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!(await matchesPassword(dto.password, user?.passwordHash)) || !user) {
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }
    const refresh = randomToken();
    // Lock the password version against concurrent resets and password changes.
    const session = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ passwordHash: string }[]>`
        SELECT "passwordHash" FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE
      `;
      if (locked[0]?.passwordHash !== user.passwordHash) throw new UnauthorizedException();
      return tx.session.create({
        data: {
          userId: user.id,
          refreshHash: tokenHash(refresh),
          expiresAt: new Date(Date.now() + refreshLifetime),
        },
      });
    });
    return this.issue(session, refresh);
  }

  async refresh(token: string) {
    const refresh = randomToken();
    const refreshHash = tokenHash(token);
    const sessions = await this.prisma.session.updateManyAndReturn({
      where: { refreshHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { refreshHash: tokenHash(refresh) },
    });
    if (!sessions[0]) throw new UnauthorizedException();
    return this.issue(sessions[0], refresh);
  }

  async validate(token: string) {
    let claims: { sub: string; sid: string };
    try {
      claims = await this.jwt.verifyAsync<{ sub: string; sid: string }>(token);
    } catch {
      throw new UnauthorizedException();
    }

    const session = await this.prisma.session.findFirst({
      where: { id: claims.sid, userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true },
    });
    if (!session) throw new UnauthorizedException();
    return session;
  }

  async logout(refresh?: string, sessionId?: string) {
    const matches = [
      ...(refresh ? [{ refreshHash: tokenHash(refresh) }] : []),
      ...(sessionId ? [{ id: sessionId }] : []),
    ];
    if (matches.length) {
      await this.prisma.session.updateMany({
        where: { OR: matches },
        data: { revokedAt: new Date() },
      });
    }
  }

  async createPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return;
    const token = randomToken();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE`;
      const now = Date.now();
      const current = await tx.passwordReset.count({
        where: { userId: user.id, expiresAt: { gt: new Date(now + resetLifetime - 60_000) } },
      });
      if (current > 0) return;
      await tx.passwordReset.create({
        data: { hash: tokenHash(token), userId: user.id, expiresAt: new Date(now + resetLifetime) },
      });
      return token;
    });
  }

  async resetPassword(token: string, password: string) {
    const hash = tokenHash(token);
    const reset = await this.prisma.passwordReset.findUnique({ where: { hash } });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date())
      throw new UnauthorizedException("Link inválido ou expirado.");
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      // Serialize reset and change for the same user before touching token rows.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${reset.userId}::uuid FOR UPDATE`;
      const used = await tx.passwordReset.updateMany({
        where: { hash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (used.count !== 1) throw new UnauthorizedException("Link inválido ou expirado.");
      await this.replacePassword(tx, reset.userId, passwordHash);
    });
  }

  async changePassword(userId: string, currentPassword: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await matchesPassword(currentPassword, user.passwordHash)))
      throw new UnauthorizedException("Senha atual inválida.");
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: userId, passwordHash: user.passwordHash },
        data: { passwordHash },
      });
      if (!result.count) throw new ConflictException("A senha mudou. Autentique-se novamente.");
      await this.replacePassword(tx, userId, passwordHash, true);
    });
  }

  private async replacePassword(
    tx: Prisma.TransactionClient,
    userId: string,
    passwordHash: string,
    alreadyUpdated = false,
  ) {
    if (!alreadyUpdated) await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    const now = new Date();
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
  }
}
