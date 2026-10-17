import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { RegisterDto } from '../../register/dto/register.dto.js';
import { SETUP_LIMITS, SETUP_STEPS } from '../../constants/setup.constants.js';
export class SaveSetupDto {
  @IsInt() @Min(0) @Max(SETUP_LIMITS.version) version!: number;
  @IsString() @Length(1, SETUP_LIMITS.organisationName) organisationName!: string;
  @IsString() @Length(1, SETUP_LIMITS.packId) packId!: string;
  @IsInt() @Min(1) @Max(SETUP_LIMITS.version) packVersion!: number;
  @IsIn(SETUP_STEPS) step!: 1 | 2 | 3;
  @ValidateIf((_o, value: unknown) => value !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => RegisterDto)
  draft!: RegisterDto | null;
}
export class CompleteSetupDto {
  @IsInt() @Min(1) @Max(SETUP_LIMITS.version) version!: number;
  @IsUUID() idempotencyKey!: string;
}
