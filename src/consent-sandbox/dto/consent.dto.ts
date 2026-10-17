import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  ValidateNested,
} from 'class-validator';
import {
  CONSENT_LIMITS,
  CONSENT_LANGUAGES,
  CONSENT_DECISIONS,
} from '../../constants/consent.constants.js';
export class ConsentPurposeDto {
  @IsUUID() id!: string;
  @IsString() @Matches(/\S/u) @MaxLength(CONSENT_LIMITS.label) labelEn!: string;
  @IsString() @Matches(/\S/u) @MaxLength(CONSENT_LIMITS.label) labelHi!: string;
}
export class CreateConsentOfferDto {
  @IsUUID() noticeId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CONSENT_LIMITS.purposes)
  @ValidateNested({ each: true })
  @Type(() => ConsentPurposeDto)
  purposes!: ConsentPurposeDto[];
  @Equals(true) syntheticOnlyAcknowledged!: true;
  @IsUUID() idempotencyKey!: string;
}
export class StartConsentParticipantDto {
  @IsUUID() offerId!: string;
  @Equals(true) syntheticAdultAcknowledged!: true;
}
export class ConsentChoiceDto {
  @IsUUID() purposeId!: string;
  @IsIn(CONSENT_DECISIONS) decision!: 'allow' | 'decline';
}
export class SubmitConsentChoicesDto {
  @IsUUID() offerId!: string;
  @IsInt() @Min(1) @Max(999999) offerVersion!: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/) catalogHash!: string;
  @IsIn(CONSENT_LANGUAGES) interfaceLanguage!: 'en' | 'hi';
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CONSENT_LIMITS.purposes)
  @ValidateNested({ each: true })
  @Type(() => ConsentChoiceDto)
  choices!: ConsentChoiceDto[];
  @Equals(true) syntheticOnlyAcknowledged!: true;
  @IsUUID() idempotencyKey!: string;
}
export class WithdrawConsentChoicesDto {
  @IsInt() @Min(1) @Max(999999) version!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CONSENT_LIMITS.purposes)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  purposeIds!: string[];
  @IsIn(CONSENT_LANGUAGES) interfaceLanguage!: 'en' | 'hi';
  @IsUUID() idempotencyKey!: string;
}
