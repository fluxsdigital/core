import { Module } from "@nestjs/common";
import { TenancyModule } from "../tenancy/tenancy.module";
import { DashboardController } from "./dashboard.controller";

@Module({ imports: [TenancyModule], controllers: [DashboardController] })
export class DashboardModule {}
