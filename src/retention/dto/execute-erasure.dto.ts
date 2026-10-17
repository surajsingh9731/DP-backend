import { IsString, IsUUID, MinLength } from "class-validator";

export class ExecuteErasureDto {
  @IsUUID()
  registerEntryId!: string;

  @IsString()
  @MinLength(1)
  notes!: string;

  @IsString()
  idempotencyKey!: string;
}
