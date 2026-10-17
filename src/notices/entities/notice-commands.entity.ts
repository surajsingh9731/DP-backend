import { Entity, PrimaryColumn, Column } from 'typeorm';
import type { NoticeSnapshotView } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'notice_commands', synchronize: false })
export class NoticeCommandEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @PrimaryColumn({ name: 'idempotency_key', type: 'uuid' }) idempotencyKey!: string;
  @Column({ name: 'payload_hash', type: 'text' }) payloadHash!: string;
  @Column({ name: 'response', type: 'jsonb' }) response!: NoticeSnapshotView;
  @Column({ name: 'notice_id', type: 'uuid' }) noticeId!: string;
}
