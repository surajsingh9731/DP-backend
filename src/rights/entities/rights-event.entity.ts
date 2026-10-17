import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { RightsEvent } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'rights_events', synchronize: false })
export class RightsEventEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'request_id', type: 'uuid' }) requestId!: string;
  @PrimaryColumn({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'data', type: 'jsonb' }) data!: RightsEvent;
}
