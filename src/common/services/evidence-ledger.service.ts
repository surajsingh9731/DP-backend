import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { EvidenceKind, EvidenceProvenance } from '@sahmati/contracts';
import { EvidenceLedgerEntryEntity } from '../entities/evidence-ledger-entry.entity';

export interface AppendEvidenceInput {
  tenantId: string;
  kind: EvidenceKind;
  sourceId: string;
  version: number;
  action: string;
  status: string;
  provenance: EvidenceProvenance;
  actorId?: string | null;
  note?: string | null;
  evidenceRefs?: string[];
  detail?: Record<string, unknown>;
}

/**
 * The single place every feature module appends an immutable evidence/audit
 * event. Called inside the SAME transaction as the entity write it
 * documents, so an event never exists without the write it describes (or
 * vice versa).
 *
 * `eventHash` chains to the previous event for the same (tenantId, kind,
 * sourceId): a bounded, single-event + immediate-previous-reference
 * integrity check. This is not a full-history audit and never authenticates
 * anything external — see EvidenceDetail.integrity on the read side.
 */
@Injectable()
export class EvidenceLedgerService {
  async append(
    manager: EntityManager,
    input: AppendEvidenceInput,
  ): Promise<EvidenceLedgerEntryEntity> {
    const previous = await manager.findOne(EvidenceLedgerEntryEntity, {
      where: { tenantId: input.tenantId, kind: input.kind, sourceId: input.sourceId },
      order: { sequence: 'DESC' },
    });
    const previousHash = previous?.eventHash ?? null;
    const canonical = JSON.stringify({
      previousHash,
      kind: input.kind,
      sourceId: input.sourceId,
      version: input.version,
      action: input.action,
      status: input.status,
      detail: input.detail ?? {},
    });
    const eventHash = createHash('sha256').update(canonical).digest('hex');

    const entry = manager.create(EvidenceLedgerEntryEntity, {
      tenantId: input.tenantId,
      kind: input.kind,
      sourceId: input.sourceId,
      version: input.version,
      action: input.action,
      status: input.status,
      provenance: input.provenance,
      actorId: input.actorId ?? null,
      note: input.note ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      detail: input.detail ?? {},
      previousHash,
      eventHash,
    });
    return manager.save(entry);
  }

  async historyFor(
    manager: EntityManager,
    tenantId: string,
    kind: EvidenceKind,
    sourceId: string,
  ): Promise<EvidenceLedgerEntryEntity[]> {
    return manager.find(EvidenceLedgerEntryEntity, {
      where: { tenantId, kind, sourceId },
      order: { sequence: 'ASC' },
    });
  }
}
