import { IsIn, IsInt, IsString, MaxLength, Min } from "class-validator";

export class SaveTemplateDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(4000)
  body!: string;

  @IsIn(["en", "hi"])
  language!: "en" | "hi";

  @IsIn(["custom-draft", "education-sample"])
  sourceKind!: "custom-draft" | "education-sample";

  @IsString()
  idempotencyKey!: string;
}
