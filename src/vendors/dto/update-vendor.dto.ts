import { IsEmail, IsInt, IsString, Min, MinLength } from "class-validator";

export class UpdateVendorDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  serviceDescription!: string;

  @IsEmail()
  contactEmail!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  idempotencyKey!: string;
}
