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
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import PDFDocument from "pdfkit";

import { AuthGuard } from "../auth/auth.guard";
import { PrismaService } from "../prisma";
import { Permission } from "../tenancy/permissions";
import {
  CurrentTenant,
  RequirePermission,
  type Tenant,
  TenantGuard,
} from "../tenancy/tenant.guard";
import { EditQuoteDto, QuoteDto, QuoteQuery, QuoteStatusDto } from "./dto";
import { QuoteService } from "./quote.service";

const uuid = new ParseUUIDPipe({ version: "4" });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (cents: number) => brl.format(cents / 100).replaceAll("\u00a0", " ");

@ApiTags("Orçamentos")
@ApiCookieAuth()
@ApiParam({ name: "organizationId", format: "uuid" })
@UseGuards(AuthGuard, TenantGuard)
@Controller("organizations/:organizationId/quotes")
export class QuoteController {
  constructor(
    private readonly quotes: QuoteService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermission(Permission.QuotesRead)
  list(@CurrentTenant() tenant: Tenant, @Query() query: QuoteQuery) {
    return this.quotes.list(tenant, query);
  }

  @Get(":id")
  @RequirePermission(Permission.QuotesRead)
  get(@CurrentTenant() tenant: Tenant, @Param("id", uuid) id: string) {
    return this.quotes.get(tenant, id);
  }

  @Post()
  @RequirePermission(Permission.QuotesWrite)
  create(@CurrentTenant() tenant: Tenant, @Body() dto: QuoteDto) {
    return this.quotes.create(tenant, dto);
  }

  @Put(":id")
  @RequirePermission(Permission.QuotesWrite)
  edit(@CurrentTenant() tenant: Tenant, @Param("id", uuid) id: string, @Body() dto: EditQuoteDto) {
    return this.quotes.edit(tenant, id, dto);
  }

  @Patch(":id/status")
  @RequirePermission(Permission.QuotesWrite)
  status(
    @CurrentTenant() tenant: Tenant,
    @Param("id", uuid) id: string,
    @Body() dto: QuoteStatusDto,
  ) {
    return this.quotes.changeStatus(tenant, id, dto.status);
  }

  @Post(":id/convert")
  @RequirePermission(Permission.QuotesWrite)
  convert(@CurrentTenant() tenant: Tenant, @Param("id", uuid) id: string) {
    return this.quotes.convert(tenant, id);
  }

  @Get(":id/pdf")
  @Header("X-Content-Type-Options", "nosniff")
  @RequirePermission(Permission.QuotesRead)
  async pdf(@CurrentTenant() tenant: Tenant, @Param("id", uuid) id: string) {
    const quote = await this.quotes.get(tenant, id);
    const company = await this.prisma.organization.findUniqueOrThrow({
      where: { id: tenant.organizationId },
      select: { name: true },
    });
    const labels = {
      DRAFT: "Rascunho",
      SENT: "Enviado",
      APPROVED: "Aprovado",
      REJECTED: "Recusado",
    };
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: quote.title } });
    doc.font("Helvetica-Bold").fontSize(22).text("Orçamento");
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(company.name)
      .text(`Referência: ${quote.id}`)
      .text(`Status: ${labels[quote.status]}`);
    doc.moveDown();
    doc.font("Helvetica-Bold").fontSize(15).text(quote.title);
    doc.font("Helvetica").fontSize(11).text(`Cliente: ${quote.customerName}`).moveDown();
    for (const line of quote.lines) {
      if (doc.y > 710) doc.addPage();
      doc.font("Helvetica-Bold").text(line.label);
      doc
        .font("Helvetica")
        .text(
          `${line.quantity} × ${money(line.unitPriceCents)} · Desconto ${money(line.discountCents)} · ${money(line.totalCents)}`,
        )
        .moveDown(0.7);
    }
    if (doc.y > 710) doc.addPage();
    doc
      .moveDown()
      .text(`Subtotal: ${money(quote.subtotalCents)}`)
      .text(`Descontos: ${money(quote.discountCents)}`);
    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .text(`Total: ${money(quote.totalCents)}`);
    const file = new StreamableFile(doc, {
      type: "application/pdf",
      disposition: `attachment; filename="orcamento-${id}.pdf"`,
    });
    doc.end();
    return file;
  }
}
