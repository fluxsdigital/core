import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsString, Length, Matches, MaxLength } from "class-validator";

export class EmailDto {
  @ApiProperty({ example: "contato@empresa.com" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class NameDto {
  @ApiProperty({ minLength: 2, maxLength: 150 })
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 150)
  name!: string;
}

export class LoginDto extends EmailDto {
  @ApiProperty({ format: "password" })
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class RegisterDto extends EmailDto {
  @ApiProperty({ minLength: 2, maxLength: 150 })
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 150)
  name!: string;

  @ApiProperty({ format: "password", minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ format: "password" })
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({ format: "password", minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  password!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;

  @ApiProperty({ format: "password", minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  password!: string;
}
