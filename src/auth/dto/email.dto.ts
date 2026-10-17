import { IsEmail, IsIn, MaxLength } from 'class-validator';
import type { Language } from '../../constants/message.constants.js';
import { AUTH_LIMITS } from '../../constants/auth.constants.js';
import { DEFAULT_MESSAGE_LANGUAGE, MESSAGE_LANGUAGES } from '../../constants/message.constants.js';
export class EmailDto {
  @IsEmail() @MaxLength(AUTH_LIMITS.emailMaxLength) email!: string;
  @IsIn(MESSAGE_LANGUAGES) language: Language = DEFAULT_MESSAGE_LANGUAGE;
}
