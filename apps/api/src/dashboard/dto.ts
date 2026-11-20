import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsHexColor,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";

export class SettingsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  displayName?: string | null;

  @ApiProperty()
  @IsHexColor()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accentColor!: string;

  @ApiProperty()
  @IsBoolean()
  directoryEnabled!: boolean;

  @ApiProperty()
  @IsBoolean()
  quotesEnabled!: boolean;

  @ApiProperty()
  @IsBoolean()
  ordersEnabled!: boolean;
}

export class DashboardQuery {
  @ApiPropertyOptional({ format: "date-time", description: "Início inclusivo" })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/T.+(?:Z|[+-]\d\d:\d\d)$/)
  from?: string;

  @ApiPropertyOptional({ format: "date-time", description: "Fim exclusivo" })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/T.+(?:Z|[+-]\d\d:\d\d)$/)
  to?: string;
}
