import { IsBoolean, IsString } from 'class-validator';

export class CreatePreviewDto {
  @IsString()
  entryId!: string;

  @IsString()
  asOf!: string;

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsString()
  idempotencyKey!: string;
}
