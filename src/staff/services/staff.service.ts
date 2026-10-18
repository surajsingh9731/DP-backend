import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { In } from "typeorm";
import type { StaffMemberView } from "@sahmati/contracts";
import { MembershipEntity } from "../../auth/entities/membership.entity";
import { UserEntity } from "../../auth/entities/user.entity";
import { OrganisationEntity } from "../../auth/entities/organisation.entity";
import { InviteStaffDto } from "../dto/invite-staff.dto";
import { UpdateStaffRoleDto } from "../dto/update-staff-role.dto";
import { RemoveStaffDto } from "../dto/remove-staff.dto";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { IdempotencyService } from "../../common/services/idempotency.service";
import { NotificationsService } from "../../notifications/services/notifications.service";
import { isEmailIdentifier } from "../../common/utils/identifier.util";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Injectable()
export class StaffService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly idempotency: IdempotencyService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(session: AuthenticatedSession): Promise<StaffMemberView[]> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();
    const memberships = await manager
      .getRepository(MembershipEntity)
      .find({ where: { tenantId }, order: { createdAt: "ASC" } });

    const users =
      memberships.length === 0
        ? []
        : await manager
            .getRepository(UserEntity)
            .findBy({ id: In(memberships.map((m) => m.userId)) });
    const userById = new Map(users.map((u) => [u.id, u]));

    return memberships.map((membership) => {
      const user = userById.get(membership.userId);
      return {
        membershipId: membership.id,
        userId: membership.userId,
        displayName: user?.displayName ?? "Unknown",
        identifier: user?.email ?? user?.phoneE164 ?? "",
        role: membership.role,
        verified: membership.verified,
        version: membership.version,
        createdAt: membership.createdAt.toISOString(),
        isCurrentUser: membership.userId === session.userId,
      };
    });
  }

  async invite(
    dto: InviteStaffDto,
    session: AuthenticatedSession,
  ): Promise<StaffMemberView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const organisation = await manager
          .getRepository(OrganisationEntity)
          .findOne({ where: { id: tenantId } });
        if (!organisation) throw new NotFoundException("Organisation not found.");

        let user = await manager.getRepository(UserEntity).findOne({
          where: isEmailIdentifier(dto.identifier)
            ? { email: dto.identifier }
            : { phoneE164: dto.identifier },
        });
        if (!user) {
          user = await manager.save(
            manager.create(UserEntity, {
              displayName: dto.displayName,
              email: isEmailIdentifier(dto.identifier) ? dto.identifier : null,
              phoneE164: isEmailIdentifier(dto.identifier) ? null : dto.identifier,
            }),
          );
        }

        const existing = await manager
          .getRepository(MembershipEntity)
          .findOne({ where: { tenantId, userId: user.id } });
        if (existing) {
          throw new ConflictException(
            "This person is already part of your organisation.",
          );
        }

        const membership = await manager.save(
          manager.create(MembershipEntity, {
            tenantId,
            userId: user.id,
            role: dto.role,
            verified: false,
          }),
        );

        await this.notifications.send({
          to: dto.identifier,
          language: dto.language,
          template: "staff_invited",
          payload: { organisationName: organisation.name, role: dto.role },
        });

        return this.toView(membership, user, session);
      },
    );
  }

  async updateRole(
    membershipId: string,
    dto: UpdateStaffRoleDto,
    session: AuthenticatedSession,
  ): Promise<StaffMemberView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const repo = manager.getRepository(MembershipEntity);
        const membership = await repo.findOne({
          where: { id: membershipId, tenantId },
        });
        if (!membership) throw new NotFoundException("Staff member not found.");
        if (membership.version !== dto.version) {
          throw new ConflictException(
            "This staff member was changed by someone else. Reload and try again.",
          );
        }

        if (membership.role === "owner" && dto.role !== "owner") {
          await this.assertNotLastOwner(tenantId, membershipId);
        }

        membership.role = dto.role;
        membership.version += 1;
        await repo.save(membership);

        const user = await manager
          .getRepository(UserEntity)
          .findOne({ where: { id: membership.userId } });
        if (!user) throw new NotFoundException("User not found.");
        return this.toView(membership, user, session);
      },
    );
  }

  async remove(
    membershipId: string,
    dto: RemoveStaffDto,
    session: AuthenticatedSession,
  ): Promise<void> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const repo = manager.getRepository(MembershipEntity);
        const membership = await repo.findOne({
          where: { id: membershipId, tenantId },
        });
        if (!membership) return;

        if (membership.role === "owner") {
          await this.assertNotLastOwner(tenantId, membershipId);
        }
        await repo.delete({ id: membershipId });
      },
    );
  }

  /** Counts owners excluding the one being demoted/removed — throws if that would leave zero. */
  private async assertNotLastOwner(
    tenantId: string,
    excludingMembershipId: string,
  ): Promise<void> {
    const manager = this.tenantContext.manager;
    const remainingOwners = await manager
      .getRepository(MembershipEntity)
      .createQueryBuilder("m")
      .where("m.tenant_id = :tenantId", { tenantId })
      .andWhere("m.role = 'owner'")
      .andWhere("m.id != :excludingMembershipId", { excludingMembershipId })
      .getCount();
    if (remainingOwners < 1) {
      throw new BadRequestException(
        "Every organisation needs at least one owner. Make someone else an owner first.",
      );
    }
  }

  private toView(
    membership: MembershipEntity,
    user: UserEntity,
    session: AuthenticatedSession,
  ): StaffMemberView {
    return {
      membershipId: membership.id,
      userId: membership.userId,
      displayName: user.displayName,
      identifier: user.email ?? user.phoneE164 ?? "",
      role: membership.role,
      verified: membership.verified,
      version: membership.version,
      createdAt: membership.createdAt.toISOString(),
      isCurrentUser: membership.userId === session.userId,
    };
  }

  private tenantId(): string {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId) {
      throw new Error(
        "No tenant context — this endpoint requires an authenticated session.",
      );
    }
    return tenantId;
  }
}
