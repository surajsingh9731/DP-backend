import { IsInt, IsString, Min } from 'class-validator';

export class CompleteSetupDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsString()
  idempotencyKey!: string;
}
