import { IsIn, IsString } from "class-validator";

export class LoginDto {
  @IsString()
  identifier!: string;

  @IsIn(["en", "hi"])
  language!: "en" | "hi";
}
