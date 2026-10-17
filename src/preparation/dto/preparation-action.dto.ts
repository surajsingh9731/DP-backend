import { IsIn, IsString, MaxLength, ValidateIf, Equals } from 'class-validator';
import { PreparationVersionDto } from './save-preparation.dto.js';
import { PREPARATION_ACTIONS, PREPARATION_LIMITS } from '../../constants/preparation.constants.js';
export class PreparationActionDto extends PreparationVersionDto {
  @IsIn(PREPARATION_ACTIONS) action!: 'submit' | 'request_changes' | 'review_internal';
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(PREPARATION_LIMITS.comment)
  comment?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Equals(true)
  internalOnlyAcknowledged?: true;
}
