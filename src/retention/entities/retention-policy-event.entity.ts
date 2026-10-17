import { Entity } from 'typeorm';
import { RetentionEventBase } from './retention-event.base.js';
@Entity({ schema: 'workspace', name: 'retention_policy_events', synchronize: false })
export class RetentionPolicyEventEntity extends RetentionEventBase {}
