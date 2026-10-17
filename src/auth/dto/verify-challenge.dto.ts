import { IsString, Length } from "class-validator";

export class VerifyChallengeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
