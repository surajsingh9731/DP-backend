import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import type { EvidenceDetail, EvidencePage } from "@sahmati/contracts";
import { TenantMembershipGuard } from "../../common/guards/tenant-membership.guard";
import { CurrentMembership } from "../../common/decorators/current-membership.decorator";
import type { CurrentMembership as Membership } from "../../common/guards/tenant-membership.guard";
import { EvidenceService } from "../services/evidence.service";
import { EvidenceFiltersDto } from "../dto/evidence-filters.dto";

@Controller("tenants/:tenantId/evidence")
@UseGuards(TenantMembershipGuard)
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Get()
  list(
    @Param("tenantId") tenantId: string,
    @Query() filters: EvidenceFiltersDto,
    @CurrentMembership() membership: Membership,
  ): Promise<EvidencePage> {
    return this.evidence.list(tenantId, filters, membership);
  }

  @Get(":kind/:id/:version")
  detail(
    @Param("tenantId") tenantId: string,
    @Param("kind") kind: string,
    @Param("id") id: string,
    @Param("version") version: string,
    @CurrentMembership() membership: Membership,
  ): Promise<EvidenceDetail> {
    return this.evidence.detail(
      tenantId,
      kind,
      id,
      Number(version),
      membership,
    );
  }
}
