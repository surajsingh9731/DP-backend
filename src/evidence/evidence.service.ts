import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { EvidencePage, EvidenceDetail, TenantScope } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { evidenceRows, evidenceRecord } from '../evidence-read/evidence-query.js';
import { EvidenceSources } from './evidence-sources.service.js';
import { evidenceWindow, evidenceCursor } from './evidence-cursor.js';
import { EvidenceQueryDto, EvidencePathDto } from './dto/evidence.dto.js';
@Injectable()
export class EvidenceService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly sources: EvidenceSources,
  ) {}
  private permitted(scope: TenantScope) {
    if (scope.role === 'viewer')
      throw new ForbiddenException('Evidence hub is limited to owners and scoped staff.');
  }
  list(scope: TenantScope, dto: EvidenceQueryDto): Promise<EvidencePage> {
    this.permitted(scope);
    const query = { ...dto, q: dto.q?.trim().toLowerCase() ?? '' };
    const window = evidenceWindow(scope, query);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const groups = [];
      for (const source of this.sources.all)
        groups.push(await evidenceRows(client, scope, source, query, window));
      const rows = groups
          .flat()
          .sort(
            (a, b) =>
              Date.parse(b.at) - Date.parse(a.at) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
          ),
        items = rows.slice(0, query.limit);
      return {
        items,
        nextCursor:
          rows.length > query.limit ? evidenceCursor(scope, query, window, items.at(-1)!) : null,
        asOf: window.asOf,
        serverTime: new Date().toISOString(),
        searchScope: 'identifiers-and-controlled-metadata',
      };
    });
  }
  detail(scope: TenantScope, path: EvidencePathDto): Promise<EvidenceDetail> {
    this.permitted(scope);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const draft = await this.sources.get(path.kind).detail(client, scope, path.id, path.version);
      for (const link of draft.related) {
        try {
          await evidenceRecord(client, scope, this.sources.get(link.kind), link.id, link.version);
          draft.detail.links.push({
            label: link.label,
            state: 'available',
            path: `/workspace/${scope.tenantId}/evidence/${link.kind}/${link.id}/${link.version}`,
          });
        } catch (error) {
          if (!(error instanceof NotFoundException)) throw error;
          draft.detail.links.push({ label: link.label, state: 'unavailable' });
        }
      }
      return draft.detail;
    });
  }
}
