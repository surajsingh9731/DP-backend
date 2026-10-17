import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateRetentionHoldDto {
  @IsString()
  entryId!: string;

  @IsIn(["activity", "sample_record", "location"])
  scope!: "activity" | "sample_record" | "location";

  @IsOptional()
  @IsString()
  target?: string;

  @IsString()
  @MaxLength(1200)
  reason!: string;

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsString()
  idempotencyKey!: string;
}

export class ReleaseRetentionHoldDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsString()
  @MaxLength(1200)
  reason!: string;

  @IsString()
  idempotencyKey!: string;
}
