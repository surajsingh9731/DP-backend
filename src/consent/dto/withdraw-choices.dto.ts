import { ArrayMinSize, IsArray, IsString } from "class-validator";

export class WithdrawChoicesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  registerEntryIds!: string[];

  @IsString()
  idempotencyKey!: string;
}
