import { IsString, IsUUID, MinLength } from "class-validator";

export class PlaceHoldDto {
  @IsUUID()
  registerEntryId!: string;

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsString()
  idempotencyKey!: string;
}
