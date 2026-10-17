import { Entity, PrimaryColumn, Column } from 'typeorm';
import type { NoticeReviewStatus } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'notice_reviews', synchronize: false })
export class NoticeReviewEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'notice_id', type: 'uuid' }) noticeId!: string;
  @Column({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'status', type: 'text' }) status!: NoticeReviewStatus;
}
