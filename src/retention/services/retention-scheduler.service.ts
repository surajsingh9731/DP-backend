import { Injectable, Logger } from "@nestjs/common";
import { MembershipEntity } from "../../auth/entities/membership.entity";
import { UserEntity } from "../../auth/entities/user.entity";
import { RetentionAlertEntity } from "../entities/retention-alert.entity";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { TenantSweepService } from "../../common/services/tenant-sweep.service";
import { EvidenceLedgerService } from "../../common/services/evidence-ledger.service";
import { MessageOutboxService } from "../../messaging/services/message-outbox.service";
import { RetentionService } from "./retention.service";

/**
 * Turns RetentionService.preview()'s on-demand dry run into an automated
 * sweep (the brief's "retention scheduler", R2): run periodically from the
 * worker process, raise exactly one alert per register entry the first
 * time it's seen overdue, and notify the organisation's owner — never
 * re-alert on every poll tick (RetentionAlertEntity is the dedupe record),
 * and never alert again at all once an entry is erased or held, since
 * `preview()` itself stops returning it.
 */
@Injectable()
export class RetentionSchedulerService {
  private readonly logger = new Logger(RetentionSchedulerService.name);

  constructor(
    private readonly tenantSweep: TenantSweepService,
    private readonly tenantContext: TenantContextService,
    private readonly retention: RetentionService,
    private readonly messageOutbox: MessageOutboxService,
    private readonly evidenceLedger: EvidenceLedgerService,
  ) {}

  async runSweep(): Promise<{ alerted: number }> {
    const counts = await this.tenantSweep.forEachTenant((tenantId) =>
      this.sweepTenant(tenantId),
    );
    return { alerted: counts.reduce((sum, count) => sum + count, 0) };
  }

  private async sweepTenant(tenantId: string): Promise<number> {
    const manager = this.tenantContext.manager;
    const overdue = (await this.retention.preview()).filter(
      (item) => item.overdue,
    );
    if (overdue.length === 0) return 0;

    const alertRepo = manager.getRepository(RetentionAlertEntity);
    const ownerContact = await this.findOwnerContact(tenantId);
    let alerted = 0;

    for (const item of overdue) {
      const existing = await alertRepo.findOne({
        where: { tenantId, registerEntryId: item.registerEntryId },
      });
      if (existing) continue;

      if (ownerContact) {
        await this.messageOutbox.enqueue(manager, {
          tenantId,
          recipient: ownerContact,
          language: "en",
          template: "retention_overdue",
          payload: { purposeEn: item.purposeEn, dueAt: item.dueAt },
        });
      } else {
        this.logger.warn(
          `No owner contact found for tenant ${tenantId} — retention alert raised with no notification sent.`,
        );
      }

      await manager.save(
        manager.create(RetentionAlertEntity, {
          tenantId,
          registerEntryId: item.registerEntryId,
        }),
      );
      await this.evidenceLedger.append(manager, {
        tenantId,
        kind: "retention_alert",
        sourceId: item.registerEntryId,
        action: "overdue_alerted",
        status: "alerted",
        actorId: null,
        provenance: "system_verified",
      });
      alerted += 1;
    }
    return alerted;
  }

  private async findOwnerContact(tenantId: string): Promise<string | null> {
    const manager = this.tenantContext.manager;
    const ownerMembership = await manager
      .getRepository(MembershipEntity)
      .findOne({ where: { tenantId, role: "owner" } });
    if (!ownerMembership) return null;
    const owner = await manager
      .getRepository(UserEntity)
      .findOne({ where: { id: ownerMembership.userId } });
    return owner?.email ?? owner?.phoneE164 ?? null;
  }
}
