import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { RightsKind, RightsAction } from '@sahmati/contracts';
import { RIGHTS_ACTIONS, RIGHTS_KINDS, RIGHTS_LIMITS } from '../../constants/rights.constants.js';
import {
  FOLLOWUP_LIMITS,
  FOLLOWUP_REFERENCE_PATTERN,
} from '../../constants/followups.constants.js';
export class RightsCorrectionDto {
  @IsString() @Matches(/\S/u) @MaxLength(RIGHTS_LIMITS.correction) fieldReference!: string;
  @IsString() @Matches(/\S/u) @MaxLength(RIGHTS_LIMITS.correction) requestedValue!: string;
}
export class SubmitRightsDto {
  @IsIn(['en', 'hi']) inputLanguage!: 'en' | 'hi';
  @IsIn(RIGHTS_KINDS) kind!: RightsKind;
  @IsString() @Matches(/\S/u) @MaxLength(RIGHTS_LIMITS.details) details!: string;
  @ValidateIf(
    (object: SubmitRightsDto, value) => object.kind === 'correction' || value !== undefined,
  )
  @IsObject()
  @ValidateNested()
  @Type(() => RightsCorrectionDto)
  correction?: RightsCorrectionDto;
  @Equals(true) syntheticOnlyAcknowledged!: true;
  @IsUUID() idempotencyKey!: string;
}
export class RightsResponseDto {
  @IsIn(['en', 'hi']) language!: 'en' | 'hi';
  @IsString() @Matches(/\S/u) @MaxLength(RIGHTS_LIMITS.response) text!: string;
  @IsIn(['complete', 'partial', 'blocked']) resolution!: 'complete' | 'partial' | 'blocked';
  @Equals(true) reviewedResponseAcknowledged!: true;
}
export class RightsActionDto {
  @IsInt() @Min(1) @Max(999999) version!: number;
  @IsIn(RIGHTS_ACTIONS) action!: RightsAction;
  @IsString() @Matches(/\S/u) @MaxLength(RIGHTS_LIMITS.note) note!: string;
  @IsArray()
  @ArrayMaxSize(FOLLOWUP_LIMITS.evidenceRefs)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(FOLLOWUP_REFERENCE_PATTERN, { each: true })
  evidenceRefs!: string[];
  @ValidateIf((_object, value) => value !== undefined && value !== null) @IsUUID() assigneeId?:
    string | null;
  @ValidateIf((_object, value) => value !== undefined) @IsUUID() workItemId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => RightsResponseDto)
  response?: RightsResponseDto;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  unresolvedAcknowledged?: boolean;
  @Equals(true) syntheticOnlyAcknowledged!: true;
  @IsUUID() idempotencyKey!: string;
}
