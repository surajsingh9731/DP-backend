import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class RegisterVendorReferenceDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(200)
  service!: string;
}

export class RegisterStorageReferenceDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsIn(['digital', 'paper'])
  medium!: 'digital' | 'paper';

  @IsString()
  @MaxLength(200)
  location!: string;
}

/** Mirrors RegisterData from @sahmati/contracts, with request-time validation bounds. */
export class RegisterDataDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(1000)
  purposeEn!: string;

  @IsString()
  @MaxLength(1000)
  purposeHi!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  dataCategories!: string[];

  @IsString()
  @MaxLength(200)
  storageLocation!: string;

  @IsString()
  @MaxLength(500)
  retentionNote!: string;

  @IsString()
  @MaxLength(200)
  contact!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RegisterVendorReferenceDto)
  vendorReferences?: RegisterVendorReferenceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RegisterStorageReferenceDto)
  storageReferences?: RegisterStorageReferenceDto[];

  @IsOptional()
  @IsBoolean()
  hasPaperRecords?: boolean;
}
