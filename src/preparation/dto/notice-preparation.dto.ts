import { IsUUID, IsInt, Min, Max } from 'class-validator';
import { PREPARATION_LIMITS } from '../../constants/preparation.constants.js';
export class NoticePreparationDto {
  @IsUUID() templateId!: string;
  @IsInt() @Min(1) @Max(PREPARATION_LIMITS.version) templateVersion!: number;
  @IsUUID() contactId!: string;
  @IsInt() @Min(1) @Max(PREPARATION_LIMITS.version) contactVersion!: number;
}
