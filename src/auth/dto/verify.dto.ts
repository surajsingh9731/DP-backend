import { IsString, IsUUID, Matches } from 'class-validator';
import { CODE_PATTERN } from '../../constants/auth.constants.js';
export class VerifyDto {
  @IsUUID() challengeId!: string;
  @IsString() @Matches(CODE_PATTERN) code!: string;
}
