import { Type } from 'class-transformer';
import { IsIn, IsInt, IsUUID, IsString, MaxLength, Max, Min, ValidateIf } from 'class-validator';
import type { EvidenceKind, EvidenceProvenance } from '@sahmati/contracts';
import {
  EVIDENCE_KINDS,
  EVIDENCE_PROVENANCE,
  EVIDENCE_LIMITS,
} from '../../constants/evidence.constants.js';
export class EvidenceQueryDto {
  @ValidateIf((_o, v) => v !== undefined) @IsIn(EVIDENCE_KINDS) kind?: EvidenceKind;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(EVIDENCE_PROVENANCE)
  provenance?: EvidenceProvenance;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MaxLength(EVIDENCE_LIMITS.search) q?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(EVIDENCE_LIMITS.maxPage) limit: number =
    EVIDENCE_LIMITS.page;
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(EVIDENCE_LIMITS.cursor)
  cursor?: string;
}
export class EvidencePathDto {
  @IsUUID() tenantId!: string;
  @IsIn(EVIDENCE_KINDS) kind!: EvidenceKind;
  @IsUUID() id!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(999999) version!: number;
}
