import { IsEmail, IsIn } from "class-validator";

export class CreateChallengeDto {
  @IsEmail()
  email!: string;

  @IsIn(["en", "hi"])
  language!: "en" | "hi";
}
