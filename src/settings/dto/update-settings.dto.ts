import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdateSettingsDto {
  @IsString()
  @MinLength(2)
  organisationName!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  contactRole?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  idempotencyKey!: string;
}
