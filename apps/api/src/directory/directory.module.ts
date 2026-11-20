import { Module } from "@nestjs/common";
import { TenancyModule } from "../tenancy/tenancy.module";
import { DirectoryController } from "./directory.controller";
import { DirectoryService } from "./directory.service";
import { DirectoryDocuments } from "./documents.service";

@Module({
  imports: [TenancyModule],
  controllers: [DirectoryController],
  providers: [DirectoryService, DirectoryDocuments],
  exports: [DirectoryService],
})
export class DirectoryModule {}
