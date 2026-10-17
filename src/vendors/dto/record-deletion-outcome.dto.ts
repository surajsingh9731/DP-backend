import { IsIn, IsInt, IsString, Min, MinLength } from "class-validator";

export class RecordDeletionOutcomeDto {
  @IsIn(["declared_complete", "failed"])
  outcome!: "declared_complete" | "failed";

  @IsString()
  @MinLength(1)
  evidenceNote!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  idempotencyKey!: string;
}
