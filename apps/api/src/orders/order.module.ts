import { Module } from "@nestjs/common";
import { DirectoryModule } from "../directory/directory.module";
import { TenancyModule } from "../tenancy/tenancy.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [DirectoryModule, TenancyModule],
  providers: [OrderService],
  controllers: [OrderController],
})
export class OrderModule {}
