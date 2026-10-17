import { IsIn, IsUUID } from 'class-validator';
import { DEFAULT_MESSAGE_LANGUAGE, MESSAGE_LANGUAGES } from '../constants/message.constants.js';
import { TASK_TEMPLATES } from '../constants/workspace.constants.js';
import type { Language } from '../constants/message.constants.js';
export class CreateTaskDto {
  @IsUUID() idempotencyKey!: string;
  @IsIn(TASK_TEMPLATES) template!: 'review_inventory';
  @IsIn(MESSAGE_LANGUAGES) language: Language = DEFAULT_MESSAGE_LANGUAGE;
}
