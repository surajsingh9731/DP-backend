import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import type { SectorPackView, SetupView } from "@sahmati/contracts";
import { SetupRecordEntity } from "../entities/setup-record.entity";
import { SaveSetupDto } from "../dto/save-setup.dto";
import { SECTOR_PACKS, findSectorPack } from "../sector-packs.data";
import { RegisterService } from "../../register/services/register.service";
import { IdempotencyService } from "../../common/services/idempotency.service";

@Injectable()
export class SetupService {
  constructor(
    @InjectRepository(SetupRecordEntity)
    private readonly setups: Repository<SetupRecordEntity>,
    private readonly dataSource: DataSource,
    private readonly register: RegisterService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async get(
    tenantId: string,
  ): Promise<{ setup: SetupView | null; packs: SectorPackView[] }> {
    const row = await this.setups.findOne({ where: { tenantId } });
    return { setup: row ? this.toView(row) : null, packs: SECTOR_PACKS };
  }

  async save(tenantId: string, dto: SaveSetupDto): Promise<SetupView> {
    const existing = await this.setups.findOne({ where: { tenantId } });
    if (existing && existing.version !== dto.version) {
      throw new ConflictException(
        "Setup progress changed since you last loaded it.",
      );
    }
    const row =
      existing ??
      this.setups.create({
        tenantId,
        version: 0,
        status: "draft",
        registerEntryId: null,
      });
    row.organisationName = dto.organisationName;
    row.packId = dto.packId;
    row.packVersion = dto.packVersion;
    row.step = dto.step;
    row.draft = dto.draft ?? null;
    row.version += 1;
    await this.setups.save(row);
    return this.toView(row);
  }

  async complete(
    tenantId: string,
    version: number,
    idempotencyKey: string,
  ): Promise<SetupView> {
    return this.dataSource.transaction(async (manager) => {
      return this.idempotency.runOnce(
        manager,
        tenantId,
        idempotencyKey,
        async () => {
          const row = await manager.findOne(SetupRecordEntity, {
            where: { tenantId },
          });
          if (!row)
            throw new ConflictException("No setup progress to complete.");
          if (row.version !== version) {
            throw new ConflictException(
              "Setup progress changed since you last loaded it.",
            );
          }
          if (row.status !== "completed" && row.draft) {
            const pack = findSectorPack(row.packId);
            const created = await this.register.create(tenantId, row.draft, {
              id: row.packId,
              version: row.packVersion,
              reviewStatus: "unreviewed",
            });
            row.registerEntryId = created.id;
            void pack;
          }
          row.status = "completed";
          row.version += 1;
          await manager.save(row);
          return this.toView(row);
        },
      );
    });
  }

  private toView(row: SetupRecordEntity): SetupView {
    return {
      version: row.version,
      organisationName: row.organisationName,
      packId: row.packId,
      packVersion: row.packVersion,
      step: row.step,
      draft: row.draft,
      status: row.status,
      registerEntryId: row.registerEntryId,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
