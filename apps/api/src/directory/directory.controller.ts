import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
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
import { DirectoryKind } from "@prisma/client";

import { NameDto } from "../auth/dto";
import { AuthGuard } from "../auth/auth.guard";
import { Permission } from "../tenancy/permissions";
import {
  CurrentTenant,
  RequirePermission,
  type Tenant,
  TenantGuard,
} from "../tenancy/tenant.guard";
import { DirectoryService } from "./directory.service";
import {
  attachmentMaxBytes,
  DirectoryDocuments,
  type UploadedAttachment,
} from "./documents.service";
import { DirectoryDto, DirectoryQuery, ListQuery, NoteDto } from "./dto";

const uuid = new ParseUUIDPipe({ version: "4" });
const recordKind = new ParseEnumPipe(DirectoryKind);

@ApiTags("Cadastros")
@ApiCookieAuth()
@ApiParam({ name: "organizationId", format: "uuid" })
@ApiParam({ name: "kind", enum: DirectoryKind })
@UseGuards(AuthGuard, TenantGuard)
@Controller("organizations/:organizationId/directory/:kind")
export class DirectoryController {
  constructor(
    private readonly directory: DirectoryService,
    private readonly documents: DirectoryDocuments,
  ) {}

  @Get()
  @RequirePermission(Permission.DirectoryRead)
  list(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Query() query: DirectoryQuery,
  ) {
    return this.directory.list(tenant, kind, query);
  }

  @Post()
  @RequirePermission(Permission.DirectoryWrite)
  create(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Body() dto: DirectoryDto,
  ) {
    return this.directory.create(tenant, kind, dto);
  }

  @Put(":id")
  @RequirePermission(Permission.DirectoryWrite)
  edit(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Param("id", uuid) id: string,
    @Body() dto: DirectoryDto,
  ) {
    return this.directory.edit(tenant, kind, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission(Permission.DirectoryWrite)
  archive(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Param("id", uuid) id: string,
  ) {
    return this.directory.archive(tenant, kind, id);
  }

  @Get(":id/notes")
  @RequirePermission(Permission.DirectoryRead)
  notes(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Param("id", uuid) id: string,
    @Query() query: ListQuery,
  ) {
    return this.documents.notes(tenant, kind, id, query);
  }

  @Post(":id/notes")
  @RequirePermission(Permission.DirectoryWrite)
  addNote(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Param("id", uuid) id: string,
    @Body() dto: NoteDto,
  ) {
    return this.documents.writeNote(tenant, kind, id, dto.content);
  }

  @Put(":id/notes/:documentId")
  @RequirePermission(Permission.DirectoryWrite)
  updateNote(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Param("id", uuid) id: string,
    @Param("documentId", uuid) documentId: string,
    @Body() dto: NoteDto,
  ) {
    return this.documents.writeNote(tenant, kind, id, dto.content, documentId);
  }

  @Delete(":id/notes/:documentId")
  @HttpCode(204)
  @RequirePermission(Permission.DirectoryWrite)
  archiveNote(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Param("id", uuid) id: string,
    @Param("documentId", uuid) documentId: string,
  ) {
    return this.documents.archive(tenant, kind, id, documentId, "note");
  }

  @Get(":id/attachments")
  @RequirePermission(Permission.DirectoryRead)
  attachments(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Param("id", uuid) id: string,
    @Query() query: ListQuery,
  ) {
    return this.documents.attachments(tenant, kind, id, query);
  }

  @Post(":id/attachments")
  @RequirePermission(Permission.DirectoryWrite)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: attachmentMaxBytes, files: 1, fields: 0 } }),
  )
  upload(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Param("id", uuid) id: string,
    @UploadedFile() file: UploadedAttachment,
  ) {
    return this.documents.upload(tenant, kind, id, file);
  }

  @Get(":id/attachments/:documentId")
  @Header("X-Content-Type-Options", "nosniff")
  @RequirePermission(Permission.DirectoryRead)
  async download(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Param("id", uuid) id: string,
    @Param("documentId", uuid) documentId: string,
  ) {
    const file = await this.documents.download(tenant, kind, id, documentId);
    const encodedName = encodeURIComponent(file.name).replace(
      /['()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16)}`,
    );
    return new StreamableFile(file.data, {
      type: file.mediaType,
      disposition: `attachment; filename*=UTF-8''${encodedName}`,
    });
  }

  @Put(":id/attachments/:documentId")
  @RequirePermission(Permission.DirectoryWrite)
  rename(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Param("id", uuid) id: string,
    @Param("documentId", uuid) documentId: string,
    @Body() dto: NameDto,
  ) {
    return this.documents.rename(tenant, kind, id, documentId, dto.name);
  }

  @Delete(":id/attachments/:documentId")
  @HttpCode(204)
  @RequirePermission(Permission.DirectoryWrite)
  archiveAttachment(
    @CurrentTenant() tenant: Tenant,
    @Param("kind", recordKind) kind: DirectoryKind,
    @Param("id", uuid) id: string,
    @Param("documentId", uuid) documentId: string,
  ) {
    return this.documents.archive(tenant, kind, id, documentId, "attachment");
  }
}
