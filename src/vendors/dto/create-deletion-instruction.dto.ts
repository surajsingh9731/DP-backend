import { IsString, IsUUID, MinLength } from "class-validator";

export class CreateDeletionInstructionDto {
  @IsUUID()
  vendorId!: string;

  @IsUUID()
  registerEntryId!: string;

  @IsString()
  @MinLength(1)
  instructionText!: string;

  @IsString()
  idempotencyKey!: string;
}
