import {
  IsInt,
  Min,
  Max,
  IsUUID,
  IsString,
  MaxLength,
  Matches,
  IsIn,
  IsEmail,
} from 'class-validator';
import {
  PREPARATION_LIMITS,
  PREPARATION_LANGUAGES,
  PREPARATION_SOURCES,
} from '../../constants/preparation.constants.js';
export class PreparationVersionDto {
  @IsInt() @Min(0) @Max(PREPARATION_LIMITS.version) version!: number;
  @IsUUID() idempotencyKey!: string;
}
export class SaveTemplateDto extends PreparationVersionDto {
  @IsString() @Matches(/\S/u) @MaxLength(PREPARATION_LIMITS.title) title!: string;
  @IsString() @Matches(/\S/u) @MaxLength(PREPARATION_LIMITS.body) body!: string;
  @IsIn(PREPARATION_LANGUAGES) language!: 'en' | 'hi';
  @IsIn(PREPARATION_SOURCES) sourceKind!: 'custom-draft' | 'education-sample';
}
export class SaveContactDto extends PreparationVersionDto {
  @IsString() @Matches(/\S/u) @MaxLength(PREPARATION_LIMITS.contactName) displayName!: string;
  @IsEmail() @MaxLength(PREPARATION_LIMITS.email) email!: string;
}
