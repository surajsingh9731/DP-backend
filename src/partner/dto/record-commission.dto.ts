import {
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class RecordCommissionDto {
  @IsUUID()
  organisationId!: string;

  @IsNumberString()
  amountInr!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;
}
