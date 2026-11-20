import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { TenantGuard } from "./tenant.guard";

@Module({
  imports: [AuthModule],
  providers: [TenantGuard],
  exports: [AuthModule, TenantGuard],
})
export class TenancyModule {}
