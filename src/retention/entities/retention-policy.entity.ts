import { Entity } from 'typeorm';
import { RetentionRecordBase } from './retention-record.base.js';
@Entity({ schema: 'workspace', name: 'retention_policies', synchronize: false })
export class RetentionPolicyEntity extends RetentionRecordBase {}
