import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class ResolveLocationDto {
  @IsInt()
  @Min(0)
  taskVersion!: number;

  @IsIn(["primary", "digital", "paper", "vendor"])
  kind!: "primary" | "digital" | "paper" | "vendor";

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(160)
  detail!: string;

  @IsString()
  @MaxLength(1000)
  rationale!: string;

  @IsArray()
  @IsString({ each: true })
  evidenceRefs!: string[];

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsString()
  idempotencyKey!: string;
}
