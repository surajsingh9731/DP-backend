import { Entity } from 'typeorm';
import { RetentionRecordBase } from './retention-record.base.js';
@Entity({ schema: 'workspace', name: 'retention_holds', synchronize: false })
export class RetentionHoldEntity extends RetentionRecordBase {}
