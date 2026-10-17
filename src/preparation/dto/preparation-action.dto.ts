import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class PreparationActionDto {
  @IsIn(['submit', 'review_internal', 'request_changes'])
  action!: 'submit' | 'review_internal' | 'request_changes';

  @IsInt()
  @Min(0)
  version!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  internalOnlyAcknowledged?: true;

  @IsString()
  idempotencyKey!: string;
}
