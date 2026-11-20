import { Module } from "@nestjs/common";

import { TenancyModule } from "../tenancy/tenancy.module";
import { CompanyController, OrganizationsController } from "./organizations.controller";

@Module({ imports: [TenancyModule], controllers: [OrganizationsController, CompanyController] })
export class OrganizationsModule {}
