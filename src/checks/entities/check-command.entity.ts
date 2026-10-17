import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { TaskEvidenceReview, CheckEvaluation, MappingResult } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'check_commands', synchronize: false })
export class CheckCommandEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @PrimaryColumn({ name: 'actor_id', type: 'uuid' }) actorId!: string;
  @PrimaryColumn({ name: 'idempotency_key', type: 'uuid' }) idempotencyKey!: string;
  @Column({ name: 'payload_hash', type: 'text' }) payloadHash!: string;
  @Column({ name: 'response', type: 'jsonb' }) response!:
    TaskEvidenceReview | CheckEvaluation | MappingResult;
}
