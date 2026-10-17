import { Entity, PrimaryColumn, Column } from 'typeorm';
import type {
  PreparationKind,
  PreparationStatus,
  PreparationData,
  SourcePack,
} from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'preparation_records', synchronize: false })
export class PreparationRecordEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ type: 'uuid' }) id!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ type: 'text' }) kind!: PreparationKind;
  @Column({ type: 'integer' }) version!: number;
  @Column({ type: 'text' }) status!: PreparationStatus;
  @Column({ type: 'jsonb' }) data!: PreparationData;
  @Column({ name: 'source_pack', type: 'jsonb', nullable: true }) sourcePack!: SourcePack | null;
  @Column({ name: 'content_hash', type: 'text' }) contentHash!: string;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
