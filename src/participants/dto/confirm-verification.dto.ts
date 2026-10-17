import { IsString, Length } from "class-validator";

export class ConfirmVerificationDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
