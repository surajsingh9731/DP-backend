import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class ConsentChoiceDto {
  @IsString()
  purposeId!: string;

  @IsIn(["allow", "decline"])
  decision!: "allow" | "decline";
}

export class SubmitChoicesDto {
  @IsString()
  offerId!: string;

  @IsInt()
  offerVersion!: number;

  @IsString()
  catalogHash!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConsentChoiceDto)
  choices!: ConsentChoiceDto[];

  @IsIn(["en", "hi"])
  interfaceLanguage!: "en" | "hi";

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsString()
  idempotencyKey!: string;
}

export class WithdrawChoicesDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  purposeIds!: string[];

  @IsIn(["en", "hi"])
  interfaceLanguage!: "en" | "hi";

  @IsString()
  idempotencyKey!: string;
}
