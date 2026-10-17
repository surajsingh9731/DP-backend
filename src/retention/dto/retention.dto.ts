import { Type } from 'class-transformer';
import {
  Equals,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import type { RetentionHold } from '@sahmati/contracts';
import { RETENTION_LIMITS, RETENTION_HOLD_SCOPES } from '../../constants/retention.constants.js';
export class RetentionCommandDto {
  @Equals(true) syntheticOnlyAcknowledged!: true;
  @IsUUID() idempotencyKey!: string;
}
export class RetentionPolicyFieldsDto extends RetentionCommandDto {
  @IsInt() @Min(1) @Max(1000000) entryVersion!: number;
  @IsString() @Matches(/\S/u) @MaxLength(RETENTION_LIMITS.name) name!: string;
  @IsInt() @Min(1) @Max(RETENTION_LIMITS.maxDays) durationDays!: number;
  @IsString() @Matches(/\S/u) @MaxLength(RETENTION_LIMITS.rationale) rationale!: string;
}
export class CreateRetentionPolicyDto extends RetentionPolicyFieldsDto {
  @IsUUID() entryId!: string;
}
export class EditRetentionPolicyDto extends RetentionPolicyFieldsDto {
  @IsInt() @Min(1) @Max(1000000) version!: number;
}
export class RetentionReasonDto extends RetentionCommandDto {
  @IsString() @Matches(/\S/u) @MaxLength(RETENTION_LIMITS.rationale) reason!: string;
}
export class RetentionPolicyActionDto extends RetentionReasonDto {
  @IsInt() @Min(1) @Max(1000000) version!: number;
  @IsIn(['submit', 'review', 'retire']) action!: 'submit' | 'review' | 'retire';
  @ValidateIf((o: RetentionPolicyActionDto, v) => o.action === 'review' || v !== undefined)
  @Equals(true)
  internalReviewAcknowledged?: true;
}
export class CreateRetentionHoldDto extends RetentionReasonDto {
  @IsUUID() entryId!: string;
  @IsIn(RETENTION_HOLD_SCOPES) scope!: RetentionHold['scope'];
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Matches(/^[a-fA-F0-9-]{1,64}$/)
  target?: string;
}
export class ReleaseRetentionHoldDto extends RetentionReasonDto {
  @IsInt() @Min(1) @Max(1000000) version!: number;
}
export class CreateRetentionPreviewDto extends RetentionCommandDto {
  @IsUUID() entryId!: string;
  @IsString() @MaxLength(40) asOf!: string;
}
export class RetentionListDto {
  @IsUUID() entryId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(RETENTION_LIMITS.maxPage) limit: number =
    RETENTION_LIMITS.page;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() after?: string;
}
export class RetentionPreviewPageDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(RETENTION_LIMITS.maxPage) limit: number =
    RETENTION_LIMITS.page;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MaxLength(600) cursor?: string;
}
