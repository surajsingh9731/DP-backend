import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";

export class RecordBreachEventDto {
  @IsIn(["contained", "dpb_notified", "principals_notified", "closed"])
  eventType!: "contained" | "dpb_notified" | "principals_notified" | "closed";

  @IsOptional()
  @IsString()
  @MinLength(1)
  notes?: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  idempotencyKey!: string;
}
