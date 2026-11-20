import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { QuoteStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { NameDto } from "../auth/dto";
import { ListQuery } from "../directory/dto";

export class QuoteLineDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  itemId!: string;

  @ApiProperty({ minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  discountCents = 0;
}

export class QuoteDto extends NameDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  customerId!: string;

  @ApiProperty({ type: [QuoteLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  lines!: QuoteLineDto[];
}

export class EditQuoteDto extends QuoteDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  revision!: number;
}

export class QuoteStatusDto {
  @ApiProperty({ enum: QuoteStatus })
  @IsEnum(QuoteStatus)
  status!: QuoteStatus;
}

export class QuoteQuery extends ListQuery {
  @ApiPropertyOptional({ enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;
}
