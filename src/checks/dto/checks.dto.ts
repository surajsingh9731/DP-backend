import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { CheckResult } from '@sahmati/contracts';
import { CHECK_LIMITS, CHECK_RESULTS, MAPPING_KINDS } from '../../constants/checks.constants.js';
import {
  FOLLOWUP_LIMITS,
  FOLLOWUP_REFERENCE_PATTERN,
} from '../../constants/followups.constants.js';
export class EvaluateChecksDto {
  @IsInt() @Min(1) @Max(999999) taskVersion!: number;
  @IsInt() @Min(0) @Max(999999) reviewVersion!: number;
  @IsUUID() idempotencyKey!: string;
}
export class ReviewEvidenceDto extends EvaluateChecksDto {
  @IsIn(['applicable', 'not_applicable']) applicability!: 'applicable' | 'not_applicable';
  @IsIn(CHECK_RESULTS) result!: CheckResult;
  @IsString() @Matches(/\S/u) @MaxLength(CHECK_LIMITS.rationale) rationale!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(FOLLOWUP_LIMITS.evidenceRefs)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(FOLLOWUP_REFERENCE_PATTERN, { each: true })
  evidenceRefs!: string[];
  @IsInt() @Min(1) @Max(CHECK_LIMITS.minutes) validForMinutes!: number;
  @Equals(true) syntheticOnlyAcknowledged!: true;
}
export class ResolveLocationDto {
  @IsInt() @Min(1) @Max(999999) taskVersion!: number;
  @IsIn(MAPPING_KINDS) kind!: 'primary' | 'digital' | 'paper' | 'vendor';
  @IsString() @Matches(/\S/u) @MaxLength(CHECK_LIMITS.label) name!: string;
  @IsString() @Matches(/\S/u) @MaxLength(CHECK_LIMITS.label) detail!: string;
  @IsString() @Matches(/\S/u) @MaxLength(CHECK_LIMITS.rationale) rationale!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(FOLLOWUP_LIMITS.evidenceRefs)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(FOLLOWUP_REFERENCE_PATTERN, { each: true })
  evidenceRefs!: string[];
  @Equals(true) syntheticOnlyAcknowledged!: true;
  @IsUUID() idempotencyKey!: string;
}
