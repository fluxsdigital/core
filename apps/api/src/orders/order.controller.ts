import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiCookieAuth, ApiParam, ApiTags } from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import { NameDto } from "../auth/dto";
import { attachmentMaxBytes, type UploadedAttachment } from "../directory/documents.service";
import { Permission } from "../tenancy/permissions";
import {
  CurrentTenant,
  RequirePermission,
  type Tenant,
  TenantGuard,
} from "../tenancy/tenant.guard";
import {
  CheckTaskDto,
  MoveOrderDto,
  OrderDto,
  OrderQuery,
  OrderSettingsDto,
  StatusUpdate,
} from "./dto";
import { OrderService } from "./order.service";

const uuid = new ParseUUIDPipe({ version: "4" });

@ApiTags("Ordens de serviço")
@ApiCookieAuth()
@ApiParam({ name: "organizationId", format: "uuid" })
@UseGuards(AuthGuard, TenantGuard)
@Controller("organizations/:organizationId/orders")
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  @RequirePermission(Permission.OrdersRead)
  list(@CurrentTenant() tenant: Tenant, @Query() query: OrderQuery) {
    return this.orders.list(tenant, query);
  }

  @Get("statuses")
  @RequirePermission(Permission.OrdersRead)
  statuses(@CurrentTenant() tenant: Tenant) {
    return this.orders.statuses(tenant);
  }

  @Post("statuses")
  @RequirePermission(Permission.OrdersConfigure)
  addStatus(@CurrentTenant() tenant: Tenant, @Body() dto: StatusUpdate) {
    return this.orders.setStatus(tenant, dto);
  }

  @Put("statuses/:key")
  @RequirePermission(Permission.OrdersConfigure)
  renameStatus(@CurrentTenant() tenant: Tenant, @Param("key") key: string, @Body() dto: NameDto) {
    return this.orders.setStatus(tenant, { name: dto.name, terminal: false }, key);
  }

  @Get(":id")
  @RequirePermission(Permission.OrdersRead)
  get(@CurrentTenant() tenant: Tenant, @Param("id", uuid) id: string) {
    return this.orders.get(tenant, id);
  }

  @Post()
  @RequirePermission(Permission.OrdersWrite)
  create(@CurrentTenant() tenant: Tenant, @Body() dto: OrderDto) {
    return this.orders.create(tenant, dto);
  }

  @Put(":id")
  @RequirePermission(Permission.OrdersWrite)
  edit(
    @CurrentTenant() tenant: Tenant,
    @Param("id", uuid) id: string,
    @Body() dto: OrderSettingsDto,
  ) {
    return this.orders.update(tenant, id, dto);
  }

  @Patch(":id/status")
  @RequirePermission(Permission.OrdersOperate)
  move(@CurrentTenant() tenant: Tenant, @Param("id", uuid) id: string, @Body() dto: MoveOrderDto) {
    return this.orders.move(tenant, id, dto);
  }

  @Post(":id/tasks")
  @RequirePermission(Permission.OrdersWrite)
  addTask(@CurrentTenant() tenant: Tenant, @Param("id", uuid) id: string, @Body() dto: NameDto) {
    return this.orders.addTask(tenant, id, dto.name);
  }

  @Patch(":id/tasks/:taskId")
  @RequirePermission(Permission.OrdersOperate)
  check(
    @CurrentTenant() tenant: Tenant,
    @Param("id", uuid) id: string,
    @Param("taskId", uuid) taskId: string,
    @Body() dto: CheckTaskDto,
  ) {
    return this.orders.check(tenant, id, taskId, dto.done);
  }

  @Post(":id/attachments")
  @RequirePermission(Permission.OrdersOperate)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: attachmentMaxBytes, files: 1, fields: 0 } }),
  )
  upload(
    @CurrentTenant() tenant: Tenant,
    @Param("id", uuid) id: string,
    @UploadedFile() file: UploadedAttachment,
  ) {
    return this.orders.upload(tenant, id, file);
  }

  @Get(":id/attachments/:fileId")
  @Header("X-Content-Type-Options", "nosniff")
  @RequirePermission(Permission.OrdersRead)
  async download(
    @CurrentTenant() tenant: Tenant,
    @Param("id", uuid) id: string,
    @Param("fileId", uuid) fileId: string,
  ) {
    const file = await this.orders.attachment(tenant, id, fileId);
    const name = encodeURIComponent(file.name).replace(
      /['()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16)}`,
    );
    return new StreamableFile(file.data, {
      type: "application/octet-stream",
      disposition: `attachment; filename*=UTF-8''${name}`,
    });
  }
}
