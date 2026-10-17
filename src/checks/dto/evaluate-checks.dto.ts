import { IsInt, IsString, Min } from 'class-validator';

export class EvaluateChecksDto {
  @IsInt()
  @Min(0)
  taskVersion!: number;

  @IsInt()
  @Min(0)
  reviewVersion!: number;

  @IsString()
  idempotencyKey!: string;
}
