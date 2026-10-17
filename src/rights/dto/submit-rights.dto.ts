import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class RightsCorrectionDto {
  @IsString()
  @MaxLength(160)
  fieldReference!: string;

  @IsString()
  @MaxLength(160)
  requestedValue!: string;
}

export class SubmitRightsDto {
  @IsIn(["access", "correction", "erasure", "grievance"])
  kind!: "access" | "correction" | "erasure" | "grievance";

  @IsIn(["en", "hi"])
  inputLanguage!: "en" | "hi";

  @IsString()
  @MaxLength(1200)
  details!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RightsCorrectionDto)
  correction?: RightsCorrectionDto;

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsString()
  idempotencyKey!: string;
}
