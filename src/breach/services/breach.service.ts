import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { BreachIncidentView } from "@sahmati/contracts";
import { BreachIncidentEntity } from "../entities/breach-incident.entity";
import { ReportBreachDto } from "../dto/report-breach.dto";
import { RecordBreachEventDto } from "../dto/record-breach-event.dto";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { IdempotencyService } from "../../common/services/idempotency.service";
import { EvidenceLedgerService } from "../../common/services/evidence-ledger.service";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Injectable()
export class BreachService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly idempotency: IdempotencyService,
    private readonly evidenceLedger: EvidenceLedgerService,
  ) {}

  async report(
    dto: ReportBreachDto,
    session: AuthenticatedSession,
  ): Promise<BreachIncidentView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const row = await manager.save(
          manager.create(BreachIncidentEntity, {
            tenantId,
            title: dto.title,
            description: dto.description,
            discoveredAt: new Date(dto.discoveredAt),
            severity: dto.severity,
            affectedDataCategories: dto.affectedDataCategories,
            affectedPrincipalsCount: dto.affectedPrincipalsCount ?? null,
            status: "open",
          }),
        );
        await this.evidenceLedger.append(manager, {
          tenantId,
          kind: "breach_incident",
          sourceId: row.id,
          action: "reported",
          status: row.status,
          actorId: session.userId,
          provenance: "declared",
        });
        return this.toView(row);
      },
    );
  }

  async list(status?: string): Promise<BreachIncidentView[]> {
    const tenantId = this.tenantId();
    const where = status
      ? { tenantId, status: status as BreachIncidentEntity["status"] }
      : { tenantId };
    const rows = await this.tenantContext
      .repo(BreachIncidentEntity)
      .find({ where, order: { discoveredAt: "DESC" } });
    return rows.map((row) => this.toView(row));
  }

  async get(id: string): Promise<BreachIncidentView> {
    return this.toView(await this.findOrThrow(id));
  }

  async recordEvent(
    id: string,
    dto: RecordBreachEventDto,
    session: AuthenticatedSession,
  ): Promise<BreachIncidentView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const row = await manager
          .getRepository(BreachIncidentEntity)
          .findOne({ where: { id, tenantId } });
        if (!row) throw new NotFoundException("Breach incident not found.");
        if (row.version !== dto.version) {
          throw new ConflictException(
            "This incident changed since you last loaded it.",
          );
        }

        switch (dto.eventType) {
          case "contained":
            row.status = "contained";
            row.containmentNotes = dto.notes ?? row.containmentNotes;
            break;
          case "dpb_notified":
            row.status = "dpb_notified";
            row.dpbNotifiedAt = new Date();
            break;
          case "principals_notified":
            row.status = "principals_notified";
            row.principalsNotifiedAt = new Date();
            break;
          case "closed":
            row.status = "closed";
            break;
        }
        row.version += 1;
        await manager.save(row);
        await this.evidenceLedger.append(manager, {
          tenantId,
          kind: "breach_incident",
          sourceId: row.id,
          action: dto.eventType,
          status: row.status,
          actorId: session.userId,
          provenance: "declared",
        });
        return this.toView(row);
      },
    );
  }

  private async findOrThrow(id: string): Promise<BreachIncidentEntity> {
    const row = await this.tenantContext
      .repo(BreachIncidentEntity)
      .findOne({ where: { id, tenantId: this.tenantId() } });
    if (!row) throw new NotFoundException("Breach incident not found.");
    return row;
  }

  private tenantId(): string {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId)
      throw new Error(
        "No tenant context — this endpoint requires an authenticated session.",
      );
    return tenantId;
  }

  private toView(row: BreachIncidentEntity): BreachIncidentView {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      discoveredAt: row.discoveredAt.toISOString(),
      severity: row.severity,
      affectedDataCategories: row.affectedDataCategories,
      affectedPrincipalsCount: row.affectedPrincipalsCount,
      status: row.status,
      containmentNotes: row.containmentNotes,
      dpbNotifiedAt: row.dpbNotifiedAt?.toISOString() ?? null,
      principalsNotifiedAt: row.principalsNotifiedAt?.toISOString() ?? null,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
