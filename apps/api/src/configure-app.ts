import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";

import { appOrigin } from "./auth/auth.config";

export function configureApp(app: NestExpressApplication) {
  const allowedOrigin = appOrigin();
  const proxyHops = process.env.TRUST_PROXY_HOPS;
  if (proxyHops && proxyHops !== "1")
    throw new Error("TRUST_PROXY_HOPS deve ser 1 ou ficar vazio.");
  if (proxyHops) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(cookieParser());
  app.use("/api/v1", (request: Request, response: Response, next: NextFunction) => {
    response.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.get("Origin") !== allowedOrigin
    ) {
      response.status(403).json({ message: "Origem não autorizada." });
      return;
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_SWAGGER !== "1") return;
  const config = new DocumentBuilder()
    .setTitle("Flux Core")
    .setDescription("API de operações empresariais")
    .setVersion("1.0")
    .addCookieAuth("flux_access")
    .build();
  SwaggerModule.setup("docs", app, () => SwaggerModule.createDocument(app, config));
}
