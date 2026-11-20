import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health";
import { DirectoryModule } from "./directory/directory.module";
import { QuoteModule } from "./quotes/quote.module";
import { OrderModule } from "./orders/order.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { PrismaModule } from "./prisma.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    DirectoryModule,
    QuoteModule,
    OrderModule,
    DashboardModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
