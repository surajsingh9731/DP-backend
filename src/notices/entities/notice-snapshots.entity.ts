import { Entity, PrimaryColumn, Column } from 'typeorm';
import type {
  NoticePreview,
  RegisterData,
  SourcePack,
  NoticePreparationSource,
} from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'notice_snapshots', synchronize: false })
export class NoticeSnapshotEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ name: 'entry_id', type: 'uuid' }) entryId!: string;
  @Column({ name: 'entry_version', type: 'integer' }) entryVersion!: number;
  @Column({ name: 'language', type: 'text' }) language!: 'en' | 'hi';
  @Column({ name: 'mode', type: 'text' }) mode!: 'local-sample';
  @Column({ name: 'legal_review_status', type: 'text' }) legalReviewStatus!: 'unreviewed';
  @Column({ name: 'register_data', type: 'jsonb' }) registerData!: RegisterData;
  @Column({ name: 'preview', type: 'jsonb' }) preview!: NoticePreview;
  @Column({ name: 'source_pack', type: 'jsonb', nullable: true }) sourcePack!: SourcePack | null;
  @Column({ name: 'preparation_source', type: 'jsonb', nullable: true })
  preparationSource!: NoticePreparationSource | null;
  @Column({ name: 'submitted_by', type: 'uuid' }) submittedBy!: string;
  @Column({ name: 'submitted_at', type: 'timestamptz' }) submittedAt!: Date;
}
