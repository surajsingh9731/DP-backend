import {
  IsEmail,
  IsIn,
  IsString,
  MinLength,
  ValidateIf,
} from "class-validator";

const PHONE_RE = /^\+[1-9]\d{7,14}$/u;

export class SignupDto {
  @IsString()
  @MinLength(2)
  organisationName!: string;

  @IsString()
  sectorPackCode!: string;

  @IsString()
  @MinLength(2)
  ownerDisplayName!: string;

  /** Email or E.164 phone number — the channel is derived from its shape, never a separate client-supplied field. */
  @IsString()
  @ValidateIf((dto: SignupDto) => !PHONE_RE.test(dto.ownerIdentifier))
  @IsEmail()
  ownerIdentifier!: string;

  @IsIn(["en", "hi"])
  language!: "en" | "hi";
}
