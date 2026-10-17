import { IsIn, IsString, MinLength } from "class-validator";

export class SubmitRightsRequestDto {
  @IsIn(["access", "correction", "erasure", "grievance", "nomination"])
  kind!: "access" | "correction" | "erasure" | "grievance" | "nomination";

  @IsString()
  @MinLength(1)
  details!: string;

  @IsString()
  idempotencyKey!: string;
}
