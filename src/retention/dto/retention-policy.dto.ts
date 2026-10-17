import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateRetentionPolicyDto {
  @IsString()
  entryId!: string;

  @IsInt()
  entryVersion!: number;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(36500)
  durationDays!: number;

  @IsString()
  @MaxLength(1200)
  rationale!: string;

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsString()
  idempotencyKey!: string;
}

export class EditRetentionPolicyDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsInt()
  entryVersion!: number;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(36500)
  durationDays!: number;

  @IsString()
  @MaxLength(1200)
  rationale!: string;

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsString()
  idempotencyKey!: string;
}

export class RetentionPolicyActionDto {
  @IsIn(["submit", "review", "retire"])
  action!: "submit" | "review" | "retire";

  @IsInt()
  @Min(0)
  version!: number;

  @IsString()
  @MaxLength(1200)
  reason!: string;

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsOptional()
  @IsBoolean()
  internalReviewAcknowledged?: true;

  @IsString()
  idempotencyKey!: string;
}
