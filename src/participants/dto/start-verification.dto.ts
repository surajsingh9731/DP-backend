import { IsIn, IsString } from "class-validator";

export class StartVerificationDto {
  @IsString()
  identifier!: string;

  @IsIn(["en", "hi"])
  language!: "en" | "hi";
}
