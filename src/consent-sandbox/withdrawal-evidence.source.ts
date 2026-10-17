import { Injectable } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import type { EvidenceSource } from '../evidence-read/evidence-source.js';
import { receiptEvidenceSql, receiptEvidenceDetail } from './consent-evidence.mapping.js';
@Injectable()
export class WithdrawalEvidenceSource implements EvidenceSource {
  readonly kind = 'withdrawal' as const;
  readonly sql = receiptEvidenceSql(this.kind);
  detail(client: DatabaseClient, scope: TenantScope, id: string, version: number) {
    return receiptEvidenceDetail(this, client, scope, id, version);
  }
}
