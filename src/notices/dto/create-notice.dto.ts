import { Type } from 'class-transformer';
import { NoticePreparationDto } from '../../preparation/dto/notice-preparation.dto.js';
import {
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
  IsObject,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { NOTICE_LIMITS, NOTICE_LANGUAGES } from '../../constants/notices.constants.js';
export class CreateNoticeDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => NoticePreparationDto)
  preparation?: NoticePreparationDto;
  @IsUUID() entryId!: string;
  @IsInt() @Min(1) @Max(NOTICE_LIMITS.version) entryVersion!: number;
  @IsIn(NOTICE_LANGUAGES) language!: 'en' | 'hi';
  @IsUUID() idempotencyKey!: string;
}
