import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ConsentPurposeDto {
  @IsString()
  id!: string;

  @IsString()
  @MaxLength(240)
  labelEn!: string;

  @IsString()
  @MaxLength(240)
  labelHi!: string;
}

export class CreateOfferDto {
  @IsString()
  noticeId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConsentPurposeDto)
  purposes!: ConsentPurposeDto[];

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsString()
  idempotencyKey!: string;
}
