import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { TaskView, WorkspaceView } from "@sahmati/contracts";
import { TenantMembershipGuard } from "../../common/guards/tenant-membership.guard";
import { CurrentMembership } from "../../common/decorators/current-membership.decorator";
import type { CurrentMembership as Membership } from "../../common/guards/tenant-membership.guard";
import { WorkspaceService } from "../services/workspace.service";
import { CreateTaskDto } from "../dto/create-task.dto";
import { CloseTaskDto } from "../dto/close-task.dto";

@Controller("tenants/:tenantId")
@UseGuards(TenantMembershipGuard)
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get("summary")
  summary(
    @Param("tenantId") tenantId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<WorkspaceView> {
    return this.workspace.summary(tenantId, membership);
  }

  @Post("tasks")
  createTask(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateTaskDto,
    @CurrentMembership() membership: Membership,
  ): Promise<TaskView> {
    return this.workspace.createTask(tenantId, dto.idempotencyKey, membership);
  }

  @Post("tasks/:id/close")
  closeTask(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() dto: CloseTaskDto,
    @CurrentMembership() membership: Membership,
  ): Promise<TaskView> {
    return this.workspace.closeTask(tenantId, id, dto.version, membership);
  }
}
