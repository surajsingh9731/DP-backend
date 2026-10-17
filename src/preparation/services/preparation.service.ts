import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { createHash } from "node:crypto";
import type {
  ContactPreparationData,
  PreparationKind,
  PreparationRecordView,
  TemplatePreparationData,
} from "@sahmati/contracts";
import { PreparationRecordEntity } from "../entities/preparation-record.entity";
import { PreparationHistoryEntity } from "../entities/preparation-history.entity";
import { SaveTemplateDto } from "../dto/save-template.dto";
import { SaveContactDto } from "../dto/save-contact.dto";
import { PreparationActionDto } from "../dto/preparation-action.dto";
import type { CurrentMembership } from "../../common/guards/tenant-membership.guard";

type SaveDto = SaveTemplateDto | SaveContactDto;

@Injectable()
export class PreparationService {
  constructor(
    @InjectRepository(PreparationRecordEntity)
    private readonly records: Repository<PreparationRecordEntity>,
    @InjectRepository(PreparationHistoryEntity)
    private readonly history: Repository<PreparationHistoryEntity>,
  ) {}

  async list(tenantId: string): Promise<PreparationRecordView[]> {
    const rows = await this.records.find({
      where: { tenantId },
      order: { createdAt: "ASC" },
    });
    return rows.map((row) => this.toView(row, []));
  }

  async get(tenantId: string, id: string): Promise<PreparationRecordView> {
    const row = await this.findOrThrow(tenantId, id);
    const events = await this.history.find({
      where: { recordId: id },
      order: { version: "ASC" },
    });
    return this.toView(row, events);
  }

  async save(
    tenantId: string,
    kind: PreparationKind,
    dto: SaveDto,
    id: string | undefined,
    actorId: string,
  ): Promise<PreparationRecordView> {
    const data: TemplatePreparationData | ContactPreparationData =
      kind === "template"
        ? {
            title: (dto as SaveTemplateDto).title,
            body: (dto as SaveTemplateDto).body,
            language: (dto as SaveTemplateDto).language,
            sourceKind: (dto as SaveTemplateDto).sourceKind,
          }
        : {
            displayName: (dto as SaveContactDto).displayName,
            email: (dto as SaveContactDto).email,
          };

    let row: PreparationRecordEntity;
    if (id) {
      row = await this.findOrThrow(tenantId, id);
      if (row.kind !== kind)
        throw new BadRequestException("Record kind mismatch.");
      if (row.version !== dto.version) {
        throw new ConflictException(
          "Saved version changed since you last loaded it.",
        );
      }
      row.data = data;
      row.status = "draft";
      row.version += 1;
    } else {
      row = this.records.create({
        tenantId,
        kind,
        version: 1,
        status: "draft",
        data,
        legalReviewStatus: "unreviewed",
        contactVerification: "unverified",
        contentHash: "",
        sourcePack:
          kind === "template" &&
          (dto as SaveTemplateDto).sourceKind === "education-sample"
            ? { id: "education", version: 1, reviewStatus: "unreviewed" }
            : null,
      });
    }
    row.contentHash = this.hash(data);
    await this.records.save(row);
    await this.history.save(
      this.history.create({
        recordId: row.id,
        tenantId,
        version: row.version,
        action: "saved",
        status: row.status,
        data,
        contentHash: row.contentHash,
        comment: "",
        actorId,
      }),
    );
    return this.toView(row, []);
  }

  async act(
    tenantId: string,
    id: string,
    dto: PreparationActionDto,
    membership: CurrentMembership,
  ): Promise<PreparationRecordView> {
    const row = await this.findOrThrow(tenantId, id);
    if (row.version !== dto.version) {
      throw new ConflictException(
        "Saved version changed since you last loaded it.",
      );
    }
    const canSubmit =
      (membership.role === "owner" ||
        (membership.role === "staff" && row.kind === "template")) &&
      (row.status === "draft" || row.status === "changes_requested");
    const canReview = membership.role === "owner" && row.status === "in_review";

    if (dto.action === "submit") {
      if (!canSubmit)
        throw new ForbiddenException(
          "Cannot submit this record in its current state.",
        );
      row.status = "in_review";
    } else {
      if (!canReview)
        throw new ForbiddenException(
          "Only an owner can review a record in review.",
        );
      if (dto.action === "review_internal") {
        if (!dto.internalOnlyAcknowledged) {
          throw new BadRequestException(
            "Acknowledge the internal-only review scope.",
          );
        }
        row.status = "internally_reviewed";
      } else {
        row.status = "changes_requested";
      }
    }
    row.version += 1;
    await this.records.save(row);
    await this.history.save(
      this.history.create({
        recordId: row.id,
        tenantId,
        version: row.version,
        action: dto.action,
        status: row.status,
        data: row.data,
        contentHash: row.contentHash,
        comment: dto.comment ?? "",
        actorId: membership.userId,
      }),
    );
    return this.toView(row, []);
  }

  private async findOrThrow(
    tenantId: string,
    id: string,
  ): Promise<PreparationRecordEntity> {
    const row = await this.records.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Preparation record not found.");
    return row;
  }

  private hash(data: unknown): string {
    return createHash("sha256").update(JSON.stringify(data)).digest("hex");
  }

  private toView(
    row: PreparationRecordEntity,
    events: PreparationHistoryEntity[],
  ): PreparationRecordView {
    return {
      id: row.id,
      kind: row.kind,
      version: row.version,
      status: row.status,
      data: row.data,
      legalReviewStatus: row.legalReviewStatus,
      contactVerification: row.contactVerification,
      contentHash: row.contentHash,
      updatedAt: row.updatedAt.toISOString(),
      sourcePack: row.sourcePack,
      history: events.map((event) => ({
        version: event.version,
        action: event.action as never,
        status: event.status,
        data: event.data,
        contentHash: event.contentHash,
        comment: event.comment,
        actorId: event.actorId,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }
}
