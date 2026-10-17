import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class EvidenceFiltersDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  provenance?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([10, 20, 50])
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
