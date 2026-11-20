import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WorkPriority } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";
import { NameDto } from "../auth/dto";
import { ListQuery } from "../directory/dto";

export class OrderSettingsDto extends NameDto {
  @ApiProperty({ enum: WorkPriority })
  @IsEnum(WorkPriority)
  priority!: WorkPriority;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID("4")
  assignedUserId?: string | null;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/T.+(?:Z|[+-]\d\d:\d\d)$/)
  dueAt?: string | null;
}

export class OrderDto extends OrderSettingsDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  customerId!: string;
}

const statusKey = /^[a-z0-9-]{1,36}$/;

export class OrderQuery extends ListQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(statusKey)
  status?: string;

  @ApiPropertyOptional({ enum: WorkPriority })
  @IsOptional()
  @IsEnum(WorkPriority)
  priority?: WorkPriority;
}

export class StatusUpdate extends NameDto {
  @ApiProperty()
  @IsBoolean()
  terminal!: boolean;
}

export class MoveOrderDto {
  @ApiProperty()
  @IsString()
  @Matches(statusKey)
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(6000)
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  report?: string;
}

export class CheckTaskDto {
  @ApiProperty()
  @IsBoolean()
  done!: boolean;
}
