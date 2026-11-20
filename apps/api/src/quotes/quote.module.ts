import { Module } from "@nestjs/common";
import { DirectoryModule } from "../directory/directory.module";
import { TenancyModule } from "../tenancy/tenancy.module";
import { QuoteController } from "./quote.controller";
import { QuoteService } from "./quote.service";

@Module({
  imports: [DirectoryModule, TenancyModule],
  controllers: [QuoteController],
  providers: [QuoteService],
})
export class QuoteModule {}
