import "dotenv/config";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";
import { configureApp } from "./configure-app";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  await app.listen(Number(process.env.API_PORT ?? 3333), process.env.API_HOST ?? "127.0.0.1");
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
