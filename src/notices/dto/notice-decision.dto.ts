import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class NoticeDecisionDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsIn(["publish_sample", "request_changes"])
  decision!: "publish_sample" | "request_changes";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  sampleOnlyAcknowledged?: true;

  @IsString()
  idempotencyKey!: string;
}
