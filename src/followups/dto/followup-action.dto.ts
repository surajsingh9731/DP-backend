import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

const FOLLOWUP_ACTIONS = [
  "assign",
  "block",
  "retry",
  "record_request",
  "declare_complete",
  "retain",
  "verify",
  "reopen",
] as const;

export class FollowupActionDto {
  @IsIn(FOLLOWUP_ACTIONS)
  action!: (typeof FOLLOWUP_ACTIONS)[number];

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

  @IsBoolean()
  syntheticOnlyAcknowledged!: true;

  @IsString()
  idempotencyKey!: string;
}
