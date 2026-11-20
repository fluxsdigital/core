import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { jwtSecret } from "./auth.config";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { accessLifetime, AuthService } from "./auth.service";
import { MailService } from "./mail.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: jwtSecret(),
        signOptions: {
          algorithm: "HS256",
          issuer: "flux-core",
          audience: "flux-core-web",
          expiresIn: accessLifetime,
        },
        verifyOptions: { algorithms: ["HS256"], issuer: "flux-core", audience: "flux-core-web" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, MailService],
  exports: [AuthGuard, AuthService],
})
export class AuthModule {}
