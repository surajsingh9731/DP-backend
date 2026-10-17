import { Entity, PrimaryColumn, Column } from 'typeorm';
import type {
  PreparationRevisionView,
  PreparationData,
  PreparationStatus,
  SourcePack,
} from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'preparation_revisions', synchronize: false })
export class PreparationRevisionEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'record_id', type: 'uuid' }) recordId!: string;
  @PrimaryColumn({ type: 'integer' }) version!: number;
  @Column({ type: 'jsonb' }) data!: PreparationData;
  @Column({ name: 'source_pack', type: 'jsonb', nullable: true }) sourcePack!: SourcePack | null;
  @Column({ type: 'text' }) status!: PreparationStatus;
  @Column({ name: 'content_hash', type: 'text' }) contentHash!: string;
  @Column({ type: 'text' }) action!: PreparationRevisionView['action'];
  @Column({ type: 'text', nullable: true }) comment!: string | null;
  @Column({ name: 'actor_id', type: 'uuid' }) actorId!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
