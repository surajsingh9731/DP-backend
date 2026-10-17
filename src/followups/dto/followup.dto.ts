import {
  ArrayMaxSize,
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
  ValidateIf,
} from 'class-validator';
import {
  FOLLOWUP_ACTIONS,
  FOLLOWUP_LIMITS,
  FOLLOWUP_REFERENCE_PATTERN,
} from '../../constants/followups.constants.js';
import type { FollowupAction } from '@sahmati/contracts';
export class CreateFollowupsDto {
  @IsUUID() receiptId!: string;
  @Equals(true) syntheticOnlyAcknowledged!: true;
  @IsUUID() idempotencyKey!: string;
}
export class FollowupActionDto {
  @IsInt() @Min(1) @Max(999999) version!: number;
  @IsIn(FOLLOWUP_ACTIONS) action!: FollowupAction;
  @IsString() @Matches(/\S/u) @MaxLength(FOLLOWUP_LIMITS.note) note!: string;
  @IsArray()
  @ArrayMaxSize(FOLLOWUP_LIMITS.evidenceRefs)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(FOLLOWUP_REFERENCE_PATTERN, { each: true })
  evidenceRefs!: string[];
  @ValidateIf((_object, value) => value !== undefined && value !== null) @IsUUID() assigneeId?:
    string | null;
  @Equals(true) syntheticOnlyAcknowledged!: true;
  @IsUUID() idempotencyKey!: string;
}
