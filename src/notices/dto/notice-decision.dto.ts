import {
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Equals,
} from 'class-validator';
import type { NoticeDecision } from '@sahmati/contracts';
import { NOTICE_LIMITS, NOTICE_DECISIONS } from '../../constants/notices.constants.js';
export class NoticeDecisionDto {
  @IsInt() @Min(1) @Max(NOTICE_LIMITS.version) version!: number;
  @IsIn(NOTICE_DECISIONS) decision!: NoticeDecision;
  @IsOptional() @IsString() @MaxLength(NOTICE_LIMITS.comment) comment?: string;
  @IsOptional() @Equals(true) sampleOnlyAcknowledged?: true;
  @IsUUID() idempotencyKey!: string;
}
