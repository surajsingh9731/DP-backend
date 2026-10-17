import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import type {
  RetentionContextView,
  RetentionHold,
  RetentionPage,
  RetentionPolicy,
  RetentionPreviewPage,
  RetentionRecordDetail,
} from "@sahmati/contracts";
import { TenantMembershipGuard } from "../../common/guards/tenant-membership.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentMembership } from "../../common/decorators/current-membership.decorator";
import type { CurrentMembership as Membership } from "../../common/guards/tenant-membership.guard";
import {
  RetentionService,
  type RetentionSavedPreview,
} from "../services/retention.service";
import {
  CreateRetentionPolicyDto,
  EditRetentionPolicyDto,
  RetentionPolicyActionDto,
} from "../dto/retention-policy.dto";
import {
  CreateRetentionHoldDto,
  ReleaseRetentionHoldDto,
} from "../dto/retention-hold.dto";
import { CreatePreviewDto } from "../dto/create-preview.dto";

@Controller("tenants/:tenantId/retention")
@UseGuards(TenantMembershipGuard)
export class RetentionController {
  constructor(private readonly retention: RetentionService) {}

  @Get("policies")
  policies(
    @Param("tenantId") tenantId: string,
    @Query("entryId") entryId: string,
    @Query("after") after?: string,
  ): Promise<RetentionPage<RetentionPolicy>> {
    return this.retention.policiesPage(tenantId, entryId, after);
  }

  @Get("holds")
  holds(
    @Param("tenantId") tenantId: string,
    @Query("entryId") entryId: string,
    @Query("after") after?: string,
  ): Promise<RetentionPage<RetentionHold>> {
    return this.retention.holdsPage(tenantId, entryId, after);
  }

  @Get("previews")
  previews(
    @Param("tenantId") tenantId: string,
    @Query("entryId") entryId: string,
    @Query("after") after?: string,
  ): Promise<RetentionPage<RetentionSavedPreview>> {
    return this.retention.previewsPage(tenantId, entryId, after);
  }

  @Get("policies/:id")
  policy(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
  ): Promise<RetentionRecordDetail<RetentionPolicy>> {
    return this.retention.policyDetail(tenantId, id);
  }

  @Get("holds/:id")
  hold(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
  ): Promise<RetentionRecordDetail<RetentionHold>> {
    return this.retention.holdDetail(tenantId, id);
  }

  @Post("policies")
  @Roles("owner", "staff")
  createPolicy(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateRetentionPolicyDto,
    @CurrentMembership() membership: Membership,
  ): Promise<RetentionPolicy> {
    return this.retention.createPolicy(tenantId, dto, membership);
  }

  @Put("policies/:id")
  @Roles("owner", "staff")
  editPolicy(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() dto: EditRetentionPolicyDto,
    @CurrentMembership() membership: Membership,
  ): Promise<RetentionPolicy> {
    return this.retention.editPolicy(tenantId, id, dto, membership);
  }

  @Post("policies/:id/actions")
  @Roles("owner", "staff")
  policyAction(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() dto: RetentionPolicyActionDto,
    @CurrentMembership() membership: Membership,
  ): Promise<RetentionPolicy> {
    return this.retention.policyAction(tenantId, id, dto, membership);
  }

  @Post("holds")
  @Roles("owner")
  createHold(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateRetentionHoldDto,
    @CurrentMembership() membership: Membership,
  ): Promise<RetentionHold> {
    return this.retention.createHold(tenantId, dto, membership);
  }

  @Post("holds/:id/release")
  @Roles("owner")
  releaseHold(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() dto: ReleaseRetentionHoldDto,
    @CurrentMembership() membership: Membership,
  ): Promise<RetentionHold> {
    return this.retention.releaseHold(tenantId, id, dto, membership);
  }

  @Get("activities/:entryId/context")
  @Roles("owner")
  context(
    @Param("tenantId") tenantId: string,
    @Param("entryId") entryId: string,
  ): Promise<RetentionContextView> {
    return this.retention.context(tenantId, entryId);
  }

  @Post("previews")
  @Roles("owner")
  createPreview(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreatePreviewDto,
  ): Promise<RetentionPreviewPage> {
    return this.retention.createPreview(tenantId, dto);
  }

  @Get("previews/:id")
  @Roles("owner")
  preview(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Query("cursor") cursor?: string,
  ): Promise<RetentionPreviewPage> {
    return this.retention.preview(tenantId, id, cursor);
  }
}
