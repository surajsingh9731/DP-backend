import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CommissionRecordView,
  PartnerOrganisationView,
  PartnerProfileView,
} from "@sahmati/contracts";
import { MembershipEntity } from "../../auth/entities/membership.entity";
import { OrganisationEntity } from "../../auth/entities/organisation.entity";
import { PartnerProfileEntity } from "../entities/partner-profile.entity";
import { CommissionRecordEntity } from "../entities/commission-record.entity";
import { UpsertPartnerProfileDto } from "../dto/upsert-partner-profile.dto";
import { RecordCommissionDto } from "../dto/record-commission.dto";
import { UpdateCommissionStatusDto } from "../dto/update-commission-status.dto";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { TenantSweepService } from "../../common/services/tenant-sweep.service";
import { DashboardService } from "../../dashboard/services/dashboard.service";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

/**
 * Module O (R2): the partner portal. Every method here is scoped by the
 * authenticated user's own identity, never by the request's home tenant —
 * a partner's whole point is seeing across several organisations they
 * hold a real membership in, not just the one they happen to be "in"
 * right now. See `ownUserRowSql`/`userOwnedTableSql` in enable-rls.ts for
 * how that's enforced at the database layer, not just in this service.
 *
 * Deliberately skips IdempotencyService: that mechanism keys its
 * dedupe table by tenant_id, which none of this module's data has. These
 * are low-frequency, staff-initiated actions (not an OTP-style flow a
 * flaky 3G connection would retry), so a plain write is an acceptable
 * trade for R2 scope.
 */
@Injectable()
export class PartnerService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantSweep: TenantSweepService,
    private readonly dashboard: DashboardService,
  ) {}

  async myOrganisations(
    session: AuthenticatedSession,
  ): Promise<PartnerOrganisationView[]> {
    const manager = this.tenantContext.manager;
    // Visible across every tenant thanks to the memberships_own_user_row
    // policy — a normal tenant-scoped find() would only ever see the
    // request's own home tenant.
    const memberships = await manager
      .getRepository(MembershipEntity)
      .find({ where: { userId: session.userId } });
    if (memberships.length === 0) return [];

    const tenantIds = memberships.map((m) => m.tenantId);
    const readinessByTenant = await this.tenantSweep.forEachTenant(
      async (tenantId) => {
        const organisation = await this.tenantContext
          .repo(OrganisationEntity)
          .findOne({ where: { id: tenantId } });
        const checks = await this.dashboard.readiness();
        return { tenantId, organisation, checks };
      },
      tenantIds,
    );

    const roleByTenant = new Map(memberships.map((m) => [m.tenantId, m.role]));
    return readinessByTenant
      .filter((entry) => entry.organisation !== null)
      .map((entry) => ({
        organisationId: entry.tenantId,
        organisationName: entry.organisation!.name,
        organisationSlug: entry.organisation!.slug,
        role: roleByTenant.get(entry.tenantId)!,
        readiness: entry.checks,
      }));
  }

  async getProfile(
    session: AuthenticatedSession,
  ): Promise<PartnerProfileView | null> {
    const row = await this.tenantContext
      .repo(PartnerProfileEntity)
      .findOne({ where: { userId: session.userId } });
    return row ? this.toProfileView(row) : null;
  }

  async upsertProfile(
    dto: UpsertPartnerProfileDto,
    session: AuthenticatedSession,
  ): Promise<PartnerProfileView> {
    const manager = this.tenantContext.manager;
    const repo = manager.getRepository(PartnerProfileEntity);
    const existing = await repo.findOne({ where: { userId: session.userId } });

    const row = existing ?? repo.create({ userId: session.userId, version: 1 });
    row.brandName = dto.brandName;
    row.logoRef = dto.logoRef ?? null;
    row.contactEmail = dto.contactEmail;
    if (existing) row.version += 1;
    await manager.save(row);
    return this.toProfileView(row);
  }

  async listCommissions(
    session: AuthenticatedSession,
  ): Promise<CommissionRecordView[]> {
    const rows = await this.tenantContext.repo(CommissionRecordEntity).find({
      where: { userId: session.userId },
      order: { createdAt: "DESC" },
    });
    return Promise.all(rows.map((row) => this.toCommissionView(row)));
  }

  async recordCommission(
    dto: RecordCommissionDto,
    session: AuthenticatedSession,
  ): Promise<CommissionRecordView> {
    const manager = this.tenantContext.manager;
    const ownMembership = await manager
      .getRepository(MembershipEntity)
      .findOne({
        where: { userId: session.userId, tenantId: dto.organisationId },
      });
    if (!ownMembership) {
      throw new BadRequestException(
        "You can only record a commission for an organisation you have a membership in.",
      );
    }

    const row = await manager.save(
      manager.create(CommissionRecordEntity, {
        userId: session.userId,
        organisationId: dto.organisationId,
        amountInr: dto.amountInr,
        note: dto.note ?? null,
        status: "pending",
      }),
    );
    return this.toCommissionView(row);
  }

  async updateCommissionStatus(
    id: string,
    dto: UpdateCommissionStatusDto,
    session: AuthenticatedSession,
  ): Promise<CommissionRecordView> {
    const manager = this.tenantContext.manager;
    const row = await manager
      .getRepository(CommissionRecordEntity)
      .findOne({ where: { id, userId: session.userId } });
    if (!row) throw new NotFoundException("Commission record not found.");
    row.status = dto.status;
    await manager.save(row);
    return this.toCommissionView(row);
  }

  private toProfileView(row: PartnerProfileEntity): PartnerProfileView {
    return {
      brandName: row.brandName,
      logoRef: row.logoRef,
      contactEmail: row.contactEmail,
      version: row.version,
    };
  }

  private async toCommissionView(
    row: CommissionRecordEntity,
  ): Promise<CommissionRecordView> {
    const organisation = await this.tenantContext
      .repo(OrganisationEntity)
      .findOne({ where: { id: row.organisationId } });
    return {
      id: row.id,
      organisationId: row.organisationId,
      organisationName: organisation?.name ?? row.organisationId,
      amountInr: row.amountInr,
      note: row.note,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
