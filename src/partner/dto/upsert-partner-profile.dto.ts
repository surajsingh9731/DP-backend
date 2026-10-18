import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class UpsertPartnerProfileDto {
  @IsString()
  @MinLength(1)
  brandName!: string;

  @IsOptional()
  @IsString()
  logoRef?: string;

  @IsEmail()
  contactEmail!: string;
}
