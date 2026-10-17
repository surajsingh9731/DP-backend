import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { EvidenceDetail, EvidenceFact, EvidenceLink, EvidenceKind, EvidencePage } from '@sahmati/contracts';
import { EvidenceLedgerEntryEntity } from '../../common/entities/evidence-ledger-entry.entity';
import { EvidenceFiltersDto } from '../dto/evidence-filters.dto';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import type { CurrentMembership } from '../../common/guards/tenant-membership.guard';

/** Maps an evidence kind to the workspace route a 'source' link should point back to. */
const SOURCE_PATHS: Record<EvidenceKind, (tenantId: string, sourceId: string) => string> = {
  notice: (t, id) => `/workspace/${t}/notices/${id}`,
  notice_decision: (t, id) => `/workspace/${t}/notices/${id}`,
  consent: (t) => `/workspace/${t}/consent-sandbox`,
  withdrawal: (t) => `/workspace/${t}/consent-sandbox`,
  followup: (t, id) => `/workspace/${t}/followups/${id}`,
  check_review: (t, id) => `/workspace/${t}/checks/${id}`,
  check_evaluation: (t, id) => `/workspace/${t}/checks/${id}`,
  rights: (t, id) => `/workspace/${t}/rights/${id}`,
};

@Injectable()
export class EvidenceService {
  constructor(
    @InjectRepository(EvidenceLedgerEntryEntity)
    private readonly ledger: Repository<EvidenceLedgerEntryEntity>,
  ) {}

  async list(
    tenantId: string,
    filters: EvidenceFiltersDto,
    membership: CurrentMembership,
  ): Promise<EvidencePage> {
    if (membership.role === 'viewer') {
      throw new ForbiddenException('Viewers do not have access to the evidence hub.');
    }
    const limit = filters.limit ?? 20;
    const query = this.ledger
      .createQueryBuilder('entry')
      .where('entry.tenantId = :tenantId', { tenantId })
      .orderBy('entry.sequence', 'DESC')
      .take(limit + 1);

    if (filters.kind) query.andWhere('entry.kind = :kind', { kind: filters.kind });
    if (filters.provenance) query.andWhere('entry.provenance = :provenance', { provenance: filters.provenance });
    if (filters.q) {
      query.andWhere('(entry.sourceId::text ILIKE :q OR entry.action ILIKE :q OR entry.status ILIKE :q)', {
        q: `%${filters.q}%`,
      });
    }
    if (filters.cursor) {
      const decoded = decodeCursor<{ sequence: string }>(filters.cursor);
      if (decoded) query.andWhere('entry.sequence < :cursor', { cursor: decoded.sequence });
    }

    const rows = await query.getMany();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const now = new Date().toISOString();

    return {
      items: page.map((row) => ({
        key: `${row.kind}:${row.sourceId}:${row.version}`,
        kind: row.kind,
        id: row.id,
        sourceId: row.sourceId,
        version: row.version,
        at: row.occurredAt.toISOString(),
        action: row.action,
        status: row.status,
        provenance: row.provenance,
      })),
      nextCursor: hasMore ? encodeCursor({ sequence: page[page.length - 1]!.sequence }) : null,
      asOf: now,
      serverTime: now,
      searchScope: 'identifiers-and-controlled-metadata',
    };
  }

  async detail(
    tenantId: string,
    kind: string,
    sourceId: string,
    version: number,
    membership: CurrentMembership,
  ): Promise<EvidenceDetail> {
    if (membership.role === 'viewer') {
      throw new ForbiddenException('Viewers do not have access to the evidence hub.');
    }
    const row = await this.ledger.findOne({ where: { tenantId, kind: kind as EvidenceKind, sourceId, version } });
    if (!row) throw new NotFoundException('Evidence event not found.');

    const latest = await this.ledger.findOne({
      where: { tenantId, kind: row.kind, sourceId },
      order: { sequence: 'DESC' },
    });
    const facts: EvidenceFact[] = [{ label: 'sourceVersion', value: row.version }];
    const links: EvidenceLink[] = [
      { label: 'source', state: 'available', path: SOURCE_PATHS[row.kind](tenantId, row.sourceId) },
    ];

    return {
      item: {
        key: `${row.kind}:${row.sourceId}:${row.version}`,
        kind: row.kind,
        id: row.id,
        sourceId: row.sourceId,
        version: row.version,
        at: row.occurredAt.toISOString(),
        action: row.action,
        status: row.status,
        provenance: row.provenance,
      },
      freshness: latest && latest.id !== row.id ? 'source_changed' : 'current',
      integrity: {
        digest: 'match',
        previous: row.previousHash ? 'linked' : 'none',
        scope: 'single-event-and-previous-reference',
      },
      facts,
      links,
      validUntil: null,
      serverTime: new Date().toISOString(),
      mode: 'local-sample',
    };
  }
}
