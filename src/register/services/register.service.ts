import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  RegisterContextView,
  RegisterEntryView,
} from "@sahmati/contracts";
import { OrganisationEntity } from "../../auth/entities/organisation.entity";
import { RegisterEntryEntity } from "../entities/register-entry.entity";
import { RegisterRevisionEntity } from "../entities/register-revision.entity";
import { CreateRegisterEntryDto } from "../dto/create-register-entry.dto";
import { UpdateRegisterEntryDto } from "../dto/update-register-entry.dto";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { IdempotencyService } from "../../common/services/idempotency.service";
import { SectorPackRegistryService } from "../../sector-packs/services/sector-pack-registry.service";
import type { AuthenticatedSession } from "../../common/guards/session.guard";
import type { SectorPack } from "../../sector-packs/sector-pack.types";

@Injectable()
export class RegisterService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly idempotency: IdempotencyService,
    private readonly sectorPacks: SectorPackRegistryService,
  ) {}

  async context(): Promise<RegisterContextView> {
    const pack = await this.activePack();
    return {
      sectorPackCode: pack.code,
      dataCategories: pack.dataCategories.map((category) => ({
        code: category.code,
        label: category.label,
        suggestedLegalBasis: category.legalBasis,
        suggestedRetentionDays: category.defaultRetentionDays,
      })),
    };
  }

  async list(): Promise<RegisterEntryView[]> {
    const pack = await this.activePack();
    const rows = await this.tenantContext.repo(RegisterEntryEntity).find({
      where: { tenantId: this.tenantId() },
      order: { createdAt: "DESC" },
    });
    return rows.map((row) => this.toView(row, pack));
  }

  async get(id: string): Promise<{
    entry: RegisterEntryView;
    history: { version: number; action: string; at: string }[];
  }> {
    const pack = await this.activePack();
    const row = await this.findOrThrow(id);
    const revisions = await this.tenantContext
      .repo(RegisterRevisionEntity)
      .find({ where: { entryId: id }, order: { version: "ASC" } });
    return {
      entry: this.toView(row, pack),
      history: revisions.map((rev) => ({
        version: rev.version,
        action: rev.action,
        at: rev.createdAt.toISOString(),
      })),
    };
  }

  async create(
    dto: CreateRegisterEntryDto,
    session: AuthenticatedSession,
  ): Promise<RegisterEntryView> {
    const pack = await this.activePack();
    const category = this.categoryOrThrow(pack, dto.categoryCode);
    const manager = this.tenantContext.manager;

    return this.idempotency.runOnce(
      manager,
      this.tenantId(),
      dto.idempotencyKey,
      async () => {
        const row = await manager.save(
          manager.create(RegisterEntryEntity, {
            tenantId: this.tenantId(),
            categoryCode: dto.categoryCode,
            purposeEn: dto.purposeEn,
            purposeHi: dto.purposeHi,
            legalBasis: dto.legalBasis,
            legalBasisOverridden: dto.legalBasis !== category.legalBasis,
            legalBasisReason: dto.legalBasisReason ?? null,
            retentionDays: dto.retentionDays ?? category.defaultRetentionDays,
            hasPaperRecords: dto.hasPaperRecords,
            vendorReferences: dto.vendorReferences,
            storageReferences: dto.storageReferences,
            status: "draft",
            version: 1,
          }),
        );
        await this.appendRevision(row, "created", session.userId);
        return this.toView(row, pack);
      },
    );
  }

  async update(
    id: string,
    dto: UpdateRegisterEntryDto,
    session: AuthenticatedSession,
  ): Promise<RegisterEntryView> {
    const pack = await this.activePack();
    const category = this.categoryOrThrow(pack, dto.categoryCode);
    const manager = this.tenantContext.manager;

    return this.idempotency.runOnce(
      manager,
      this.tenantId(),
      dto.idempotencyKey,
      async () => {
        const row = await this.findOrThrow(id);
        if (row.version !== dto.version) {
          throw new ConflictException(
            "This register entry changed since you last loaded it.",
          );
        }
        row.categoryCode = dto.categoryCode;
        row.purposeEn = dto.purposeEn;
        row.purposeHi = dto.purposeHi;
        row.legalBasis = dto.legalBasis;
        row.legalBasisOverridden = dto.legalBasis !== category.legalBasis;
        row.legalBasisReason = dto.legalBasisReason ?? null;
        row.retentionDays = dto.retentionDays ?? category.defaultRetentionDays;
        row.hasPaperRecords = dto.hasPaperRecords;
        row.vendorReferences = dto.vendorReferences;
        row.storageReferences = dto.storageReferences;
        row.version += 1;
        await manager.save(row);
        await this.appendRevision(row, "updated", session.userId);
        return this.toView(row, pack);
      },
    );
  }

  private async appendRevision(
    row: RegisterEntryEntity,
    action: "created" | "updated" | "published",
    actorUserId: string,
  ): Promise<void> {
    const manager = this.tenantContext.manager;
    await manager.save(
      manager.create(RegisterRevisionEntity, {
        tenantId: row.tenantId,
        entryId: row.id,
        version: row.version,
        action,
        actorUserId,
        snapshot: { ...row },
      }),
    );
  }

  private async activePack(): Promise<SectorPack> {
    const organisation = await this.tenantContext
      .repo(OrganisationEntity)
      .findOne({ where: { id: this.tenantId() } });
    if (!organisation) throw new NotFoundException("Organisation not found.");
    return this.sectorPacks.getActive(organisation.sectorPackCode);
  }

  private categoryOrThrow(pack: SectorPack, categoryCode: string) {
    const category = pack.dataCategories.find((c) => c.code === categoryCode);
    if (!category) {
      throw new BadRequestException(
        `Unknown data category for this sector pack: ${categoryCode}.`,
      );
    }
    return category;
  }

  private async findOrThrow(id: string): Promise<RegisterEntryEntity> {
    const row = await this.tenantContext
      .repo(RegisterEntryEntity)
      .findOne({ where: { id, tenantId: this.tenantId() } });
    if (!row) throw new NotFoundException("Register entry not found.");
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

  private toView(
    row: RegisterEntryEntity,
    pack: SectorPack,
  ): RegisterEntryView {
    const category = pack.dataCategories.find(
      (c) => c.code === row.categoryCode,
    );
    return {
      id: row.id,
      categoryCode: row.categoryCode,
      categoryLabel: category?.label ?? {
        en: row.categoryCode,
        hi: row.categoryCode,
      },
      purposeEn: row.purposeEn,
      purposeHi: row.purposeHi,
      legalBasis: row.legalBasis,
      suggestedLegalBasis: category?.legalBasis ?? row.legalBasis,
      legalBasisOverridden: row.legalBasisOverridden,
      legalBasisReason: row.legalBasisReason,
      retentionDays: row.retentionDays,
      hasPaperRecords: row.hasPaperRecords,
      vendorReferences: row.vendorReferences,
      storageReferences: row.storageReferences,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
