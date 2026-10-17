import { IsEmail, IsInt, IsString, MaxLength, Min } from "class-validator";

export class SaveContactDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsString()
  @MaxLength(120)
  displayName!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  idempotencyKey!: string;
}
