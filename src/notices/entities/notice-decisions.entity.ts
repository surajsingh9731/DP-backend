import { Entity, PrimaryColumn, Column } from 'typeorm';
import type { NoticeDecision } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'notice_decisions', synchronize: false })
export class NoticeDecisionEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;
  @Column({ name: 'notice_id', type: 'uuid' }) noticeId!: string;
  @Column({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'decision', type: 'text' }) decision!: NoticeDecision;
  @Column({ name: 'comment', type: 'text', nullable: true }) comment!: string | null;
  @Column({ name: 'decided_by', type: 'uuid' }) decidedBy!: string;
  @Column({ name: 'decided_at', type: 'timestamptz' }) decidedAt!: Date;
}
