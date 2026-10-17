import { IsIn, IsInt, IsString, Min, MinLength } from "class-validator";

export class RespondRightsRequestDto {
  @IsIn(["under_review", "responded", "closed"])
  status!: "under_review" | "responded" | "closed";

  @IsString()
  @MinLength(1)
  responseText!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  idempotencyKey!: string;
}
