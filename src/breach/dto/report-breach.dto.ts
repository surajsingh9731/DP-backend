import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";

export class ReportBreachDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsDateString()
  discoveredAt!: string;

  @IsIn(["low", "medium", "high", "critical"])
  severity!: "low" | "medium" | "high" | "critical";

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  affectedDataCategories!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  affectedPrincipalsCount?: number;

  @IsString()
  idempotencyKey!: string;
}
