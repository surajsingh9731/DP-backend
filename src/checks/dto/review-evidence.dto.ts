import { IsArray, IsBoolean, IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class ReviewEvidenceDto {
  @IsInt()
  @Min(0)
  taskVersion!: number;

  @IsInt()
  @Min(0)
  reviewVersion!: number;

  @IsIn(['applicable', 'not_applicable'])
  applicability!: 'applicable' | 'not_applicable';

  @IsIn(['pass', 'fail', 'unknown', 'not_applicable'])
  result!: 'pass' | 'fail' | 'unknown' | 'not_applicable';

  @IsString()
  @MaxLength(1000)
  rationale!: string;

  @IsArray()
  @IsString({ each: true })
  evidenceRefs!: string[];

  @IsInt()
  @Min(1)
  @Max(1440)
  validForMinutes!: number;

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsString()
  idempotencyKey!: string;
}
