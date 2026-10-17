import { Injectable, NotFoundException } from "@nestjs/common";
import type { DashboardCheckView } from "@sahmati/contracts";
import { OrganisationEntity } from "../../auth/entities/organisation.entity";
import { RegisterEntryEntity } from "../../register/entities/register-entry.entity";
import { NoticeEntity } from "../../notices/entities/notice.entity";
import { ConsentReceiptEntity } from "../../consent/entities/consent-receipt.entity";
import { WithdrawalFollowupEntity } from "../../consent/entities/withdrawal-followup.entity";
import { RightsRequestEntity } from "../../rights/entities/rights-request.entity";
import { BreachIncidentEntity } from "../../breach/entities/breach-incident.entity";
import { MessageOutboxEntity } from "../../messaging/entities/message-outbox.entity";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { RetentionService } from "../../retention/services/retention.service";

/**
 * Every "live check" is computed from the other modules' own tables at
 * read time — same reasoning as RetentionService.preview(): a cached
 * dashboard row would go stale the instant anything underneath it
 * changes, so there's nothing worth persisting here. This module reads
 * other modules' entities directly (their metadata is global to the one
 * DataSource) rather than importing their modules, since this is a
 * read-only cross-module aggregation, never a write.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly retention: RetentionService,
  ) {}

  async readiness(): Promise<DashboardCheckView[]> {
    const tenantId = this.tenantId();
    const manager = this.tenantContext.manager;

    // Sequential, not Promise.all: this request's manager runs on one
    // dedicated pg connection for the whole transaction (see
    // TenantContextInterceptor), not a pool — concurrent queries on it
    // would interleave on the same socket instead of actually running in
    // parallel.
    const organisation = await manager
      .getRepository(OrganisationEntity)
      .findOne({ where: { id: tenantId } });
    if (!organisation) throw new NotFoundException("Organisation not found.");

    const registerEntryCount = await manager
      .getRepository(RegisterEntryEntity)
      .count({ where: { tenantId } });
    const consentReceiptCount = await manager
      .getRepository(ConsentReceiptEntity)
      .count({ where: { tenantId } });
    const openFollowupCount = await manager
      .getRepository(WithdrawalFollowupEntity)
      .count({ where: { tenantId, status: "open" } });
    const openRightsRequests = await manager
      .getRepository(RightsRequestEntity)
      .count({ where: { tenantId, status: "requested" } });
    const overdueRightsRequests = await manager
      .getRepository(RightsRequestEntity)
      .createQueryBuilder("r")
      .where("r.tenant_id = :tenantId", { tenantId })
      .andWhere("r.status NOT IN ('responded', 'closed')")
      .andWhere("r.due_at < now()")
      .getCount();
    const openBreachIncidents = await manager
      .getRepository(BreachIncidentEntity)
      .createQueryBuilder("b")
      .where("b.tenant_id = :tenantId", { tenantId })
      .andWhere("b.status <> 'closed'")
      .getCount();
    const retentionOverdue = (await this.retention.preview()).filter(
      (item) => item.overdue,
    ).length;
    const failedMessages = await manager
      .getRepository(MessageOutboxEntity)
      .count({ where: { tenantId, status: "failed" } });
    const notice = await manager
      .getRepository(NoticeEntity)
      .findOne({ where: { tenantId } });

    return [
      {
        id: "register",
        title: "Data register",
        href: "/register",
        status: registerEntryCount > 0 ? "ok" : "danger",
        summary:
          registerEntryCount > 0
            ? `${registerEntryCount} data categor${registerEntryCount === 1 ? "y" : "ies"} on record.`
            : "No data categories recorded yet — start the register before publishing a notice.",
        count: registerEntryCount,
      },
      {
        id: "notice",
        title: "Privacy notice",
        href: "/notices",
        status: organisation.noticePublished ? "ok" : "danger",
        summary: organisation.noticePublished
          ? `Published${notice?.publishedAt ? ` on ${notice.publishedAt.toISOString().slice(0, 10)}` : ""}.`
          : "No public privacy notice is published yet.",
        count: organisation.noticePublished ? 1 : 0,
      },
      {
        id: "consent",
        title: "Consent captured",
        href: "/consent",
        status: "ok",
        summary: `${consentReceiptCount} consent action${consentReceiptCount === 1 ? "" : "s"} recorded to date.`,
        count: consentReceiptCount,
      },
      {
        id: "withdrawal_followups",
        title: "Withdrawal follow-ups",
        href: "/consent/followups",
        status: openFollowupCount > 0 ? "warning" : "ok",
        summary:
          openFollowupCount > 0
            ? `${openFollowupCount} erasure follow-up task${openFollowupCount === 1 ? "" : "s"} waiting on staff.`
            : "No open withdrawal follow-ups.",
        count: openFollowupCount,
      },
      {
        id: "rights",
        title: "Rights & grievance desk",
        href: "/rights",
        status:
          overdueRightsRequests > 0
            ? "danger"
            : openRightsRequests > 0
              ? "warning"
              : "ok",
        summary:
          overdueRightsRequests > 0
            ? `${overdueRightsRequests} request${overdueRightsRequests === 1 ? "" : "s"} past the response window.`
            : openRightsRequests > 0
              ? `${openRightsRequests} request${openRightsRequests === 1 ? "" : "s"} awaiting a response.`
              : "No open rights requests.",
        count: openRightsRequests,
      },
      {
        id: "breach",
        title: "Breach desk",
        href: "/breach",
        status: openBreachIncidents > 0 ? "danger" : "ok",
        summary:
          openBreachIncidents > 0
            ? `${openBreachIncidents} incident${openBreachIncidents === 1 ? "" : "s"} still open.`
            : "No open breach incidents.",
        count: openBreachIncidents,
      },
      {
        id: "retention",
        title: "Retention & erasure",
        href: "/retention",
        status: retentionOverdue > 0 ? "danger" : "ok",
        summary:
          retentionOverdue > 0
            ? `${retentionOverdue} register entr${retentionOverdue === 1 ? "y" : "ies"} past their retention window.`
            : "Nothing is currently overdue for erasure.",
        count: retentionOverdue,
      },
      {
        id: "messaging",
        title: "Outbound messages",
        href: "/messages",
        status: failedMessages > 0 ? "warning" : "ok",
        summary:
          failedMessages > 0
            ? `${failedMessages} message${failedMessages === 1 ? "" : "s"} failed delivery after retries.`
            : "No failed message deliveries.",
        count: failedMessages,
      },
    ];
  }

  private tenantId(): string {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId)
      throw new Error(
        "No tenant context — this endpoint requires an authenticated session.",
      );
    return tenantId;
  }
}
