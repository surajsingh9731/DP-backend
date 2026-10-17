import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  ValidateNested,
} from "class-validator";

export class ConsentChoiceDto {
  @IsString()
  registerEntryId!: string;

  @IsIn(["accept", "decline"])
  decision!: "accept" | "decline";
}

export class RecordChoicesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsentChoiceDto)
  choices!: ConsentChoiceDto[];

  @IsString()
  idempotencyKey!: string;
}
