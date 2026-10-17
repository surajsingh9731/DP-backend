import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsBoolean,
  ValidateIf,
  ValidateNested,
  IsIn,
  IsInt,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { RegisterData, VendorReference, StorageReference } from '@sahmati/contracts';
import {
  REGISTER_LIMITS,
  REGISTER_PREVIEW_LANGUAGES,
  STORAGE_MEDIA,
} from '../../constants/register.constants.js';
export class VendorReferenceDto implements VendorReference {
  @IsString() @Length(1, REGISTER_LIMITS.referenceName) name!: string;
  @IsString() @Length(1, REGISTER_LIMITS.referenceDetail) service!: string;
}
export class StorageReferenceDto implements StorageReference {
  @IsString() @Length(1, REGISTER_LIMITS.referenceName) name!: string;
  @IsIn(STORAGE_MEDIA) medium!: 'digital' | 'paper';
  @IsString() @Length(1, REGISTER_LIMITS.referenceDetail) location!: string;
}
export class RegisterDto implements RegisterData {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(REGISTER_LIMITS.references)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => VendorReferenceDto)
  vendorReferences?: VendorReferenceDto[];
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(REGISTER_LIMITS.references)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => StorageReferenceDto)
  storageReferences?: StorageReferenceDto[];
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  hasPaperRecords?: boolean;

  @IsString() @Length(1, REGISTER_LIMITS.name) name!: string;
  @IsString() @Length(1, REGISTER_LIMITS.purpose) purposeEn!: string;
  @IsString() @Length(1, REGISTER_LIMITS.purpose) purposeHi!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(REGISTER_LIMITS.categories)
  @IsString({ each: true })
  @Length(1, REGISTER_LIMITS.category, { each: true })
  dataCategories!: string[];
  @IsString() @Length(1, REGISTER_LIMITS.storage) storageLocation!: string;
  @IsString() @Length(1, REGISTER_LIMITS.retention) retentionNote!: string;
  @IsString() @Length(1, REGISTER_LIMITS.contact) contact!: string;
}
export class UpdateRegisterDto extends RegisterDto {
  @IsInt() @Min(1) @Max(REGISTER_LIMITS.version) version!: number;
}
export class PreviewQuery {
  @IsIn(REGISTER_PREVIEW_LANGUAGES) language: 'en' | 'hi' = 'en';
}
