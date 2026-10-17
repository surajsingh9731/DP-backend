import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const RIGHTS_ACTIONS = [
  "assign",
  "begin_review",
  "declare_item",
  "verify_item",
  "block_item",
  "retain_item",
  "retry_item",
  "respond",
  "close",
  "reopen",
] as const;

export class RightsResponseInputDto {
  @IsIn(["en", "hi"])
  language!: "en" | "hi";

  @IsString()
  @MaxLength(2000)
  text!: string;

  @IsIn(["complete", "partial", "blocked"])
  resolution!: "complete" | "partial" | "blocked";

  @IsBoolean()
  reviewedResponseAcknowledged!: true;
}

export class RightsActionDto {
  @IsIn(RIGHTS_ACTIONS)
  action!: (typeof RIGHTS_ACTIONS)[number];

  @IsInt()
  @Min(0)
  version!: number;

  @IsString()
  @MaxLength(1000)
  note!: string;

  @IsArray()
  @IsString({ each: true })
  evidenceRefs!: string[];

  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsString()
  workItemId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RightsResponseInputDto)
  response?: RightsResponseInputDto;

  @IsOptional()
  @IsBoolean()
  unresolvedAcknowledged?: boolean;

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsString()
  idempotencyKey!: string;
}
