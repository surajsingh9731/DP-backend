import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { OrganisationSettingsView } from "@sahmati/contracts";
import { OrganisationEntity } from "../../auth/entities/organisation.entity";
import { BranchEntity } from "../../auth/entities/branch.entity";
import { UpdateSettingsDto } from "../dto/update-settings.dto";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { IdempotencyService } from "../../common/services/idempotency.service";

@Injectable()
export class SettingsService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async get(): Promise<OrganisationSettingsView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();
    const organisation = await manager
      .getRepository(OrganisationEntity)
      .findOne({ where: { id: tenantId } });
    if (!organisation) throw new NotFoundException("Organisation not found.");

    const branches = await manager
      .getRepository(BranchEntity)
      .find({ where: { tenantId }, order: { createdAt: "ASC" } });

    return this.toView(organisation, branches);
  }

  async update(
    dto: UpdateSettingsDto,
  ): Promise<OrganisationSettingsView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const repo = manager.getRepository(OrganisationEntity);
        const organisation = await repo.findOne({ where: { id: tenantId } });
        if (!organisation) throw new NotFoundException("Organisation not found.");
        if (organisation.version !== dto.version) {
          throw new ConflictException(
            "Settings were changed by someone else. Reload and try again.",
          );
        }

        organisation.name = dto.organisationName;
        organisation.contactName = dto.contactName ?? null;
        organisation.contactRole = dto.contactRole ?? null;
        organisation.contactPhone = dto.contactPhone ?? null;
        organisation.contactEmail = dto.contactEmail ?? null;
        organisation.version += 1;
        await repo.save(organisation);

        const branches = await manager
          .getRepository(BranchEntity)
          .find({ where: { tenantId }, order: { createdAt: "ASC" } });
        return this.toView(organisation, branches);
      },
    );
  }

  private toView(
    organisation: OrganisationEntity,
    branches: BranchEntity[],
  ): OrganisationSettingsView {
    return {
      organisationName: organisation.name,
      organisationSlug: organisation.slug,
      contactName: organisation.contactName,
      contactRole: organisation.contactRole,
      contactPhone: organisation.contactPhone,
      contactEmail: organisation.contactEmail,
      version: organisation.version,
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        isPrimary: b.isPrimary,
      })),
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
