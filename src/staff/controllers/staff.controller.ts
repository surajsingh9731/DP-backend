import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import type { StaffMemberView } from "@sahmati/contracts";
import { StaffService } from "../services/staff.service";
import { InviteStaffDto } from "../dto/invite-staff.dto";
import { UpdateStaffRoleDto } from "../dto/update-staff-role.dto";
import { RemoveStaffDto } from "../dto/remove-staff.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Controller("staff")
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(@CurrentSession() session: AuthenticatedSession): Promise<StaffMemberView[]> {
    return this.staff.list(session);
  }

  @Roles("owner")
  @Post("invite")
  invite(
    @Body() dto: InviteStaffDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<StaffMemberView> {
    return this.staff.invite(dto, session);
  }

  @Roles("owner")
  @Put(":id/role")
  updateRole(
    @Param("id") id: string,
    @Body() dto: UpdateStaffRoleDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<StaffMemberView> {
    return this.staff.updateRole(id, dto, session);
  }

  @Roles("owner")
  @Delete(":id")
  remove(
    @Param("id") id: string,
    @Body() dto: RemoveStaffDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<void> {
    return this.staff.remove(id, dto, session);
  }
}
