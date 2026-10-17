import { Entity } from 'typeorm';
import { RetentionEventBase } from './retention-event.base.js';
@Entity({ schema: 'workspace', name: 'retention_hold_events', synchronize: false })
export class RetentionHoldEventEntity extends RetentionEventBase {}
