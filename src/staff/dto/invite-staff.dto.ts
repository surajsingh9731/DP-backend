import { IsEmail, IsIn, IsString, MinLength, ValidateIf } from "class-validator";
import { isEmailIdentifier } from "../../common/utils/identifier.util";

export class InviteStaffDto {
  @IsString()
  @MinLength(2)
  displayName!: string;

  /** Email or E.164 phone — same shape as signup/login, channel derived from it. */
  @IsString()
  @ValidateIf((dto: InviteStaffDto) => !isEmailIdentifier(dto.identifier))
  @IsEmail()
  identifier!: string;

  @IsIn(["owner", "staff", "viewer"])
  role!: "owner" | "staff" | "viewer";

  @IsIn(["en", "hi"])
  language!: "en" | "hi";

  @IsString()
  idempotencyKey!: string;
}
