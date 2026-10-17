import { IsEmail, IsString, MinLength } from "class-validator";

export class CreateVendorDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  serviceDescription!: string;

  @IsEmail()
  contactEmail!: string;

  @IsString()
  idempotencyKey!: string;
}
