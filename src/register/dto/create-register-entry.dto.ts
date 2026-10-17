import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class VendorReferenceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  service!: string;
}

export class StorageReferenceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  location!: string;

  @IsIn(["digital", "paper"])
  medium!: "digital" | "paper";
}

export class CreateRegisterEntryDto {
  @IsString()
  categoryCode!: string;

  @IsString()
  @MinLength(1)
  purposeEn!: string;

  @IsString()
  @MinLength(1)
  purposeHi!: string;

  @IsIn(["consent", "legitimate_use"])
  legalBasis!: "consent" | "legitimate_use";

  @IsOptional()
  @IsString()
  legalBasisReason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number;

  @IsBoolean()
  hasPaperRecords!: boolean;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => VendorReferenceDto)
  vendorReferences!: VendorReferenceDto[];

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => StorageReferenceDto)
  storageReferences!: StorageReferenceDto[];

  @IsString()
  idempotencyKey!: string;
}
