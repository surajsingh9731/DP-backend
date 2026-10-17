import { IsBoolean, IsString } from 'class-validator';

export class CreateFromReceiptDto {
  @IsString()
  receiptId!: string;

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsString()
  idempotencyKey!: string;
}
