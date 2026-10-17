import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { NoticeSnapshotView } from "@sahmati/contracts";
import * as QRCode from "qrcode";
import { NoticeSnapshotEntity } from "../entities/notice-snapshot.entity";
import { CreateNoticeDto } from "../dto/create-notice.dto";
import { NoticeDecisionDto } from "../dto/notice-decision.dto";
import { RegisterService } from "../../register/services/register.service";
import { PreparationService } from "../../preparation/services/preparation.service";
import { NoticePdfService } from "./notice-pdf.service";
import type { CurrentMembership } from "../../common/guards/tenant-membership.guard";
import type {
  TemplatePreparationData,
  ContactPreparationData,
} from "@sahmati/contracts";
import { DataSource } from "typeorm";
import { EvidenceLedgerService } from "../../common/services/evidence-ledger.service";

@Injectable()
export class NoticesService {
  constructor(
    @InjectRepository(NoticeSnapshotEntity)
    private readonly snapshots: Repository<NoticeSnapshotEntity>,
    private readonly register: RegisterService,
    private readonly preparation: PreparationService,
    private readonly pdf: NoticePdfService,
    private readonly dataSource: DataSource,
    private readonly evidence: EvidenceLedgerService,
  ) {}

  async list(tenantId: string): Promise<NoticeSnapshotView[]> {
    const rows = await this.snapshots.find({
      where: { tenantId },
      order: { submittedAt: "DESC" },
    });
    return rows.map((row) => this.toView(row));
  }

  async get(tenantId: string, id: string): Promise<NoticeSnapshotView> {
    return this.toView(await this.findOrThrow(tenantId, id));
  }

  async submit(
    tenantId: string,
    dto: CreateNoticeDto,
    membership: CurrentMembership,
  ): Promise<NoticeSnapshotView> {
    const preview = await this.register.noticePreview(
      tenantId,
      dto.entryId,
      dto.language,
    );
    if (preview.version !== dto.entryVersion) {
      throw new ConflictException(
        "The register entry changed since this notice was prepared.",
      );
    }
    const registerEntries = await this.register.list(tenantId);
    const entry = registerEntries.find((row) => row.id === dto.entryId);
    if (!entry) throw new NotFoundException("Register entry not found.");

    let preparationSource = null;
    if (dto.preparation) {
      const template = await this.preparation.get(
        tenantId,
        dto.preparation.templateId,
      );
      const contact = await this.preparation.get(
        tenantId,
        dto.preparation.contactId,
      );
      if (
        template.kind !== "template" ||
        template.status !== "internally_reviewed" ||
        template.version !== dto.preparation.templateVersion ||
        contact.kind !== "contact" ||
        contact.status !== "internally_reviewed" ||
        contact.version !== dto.preparation.contactVersion
      ) {
        throw new BadRequestException(
          "The chosen preparation records are not both at their internally reviewed version.",
        );
      }
      preparationSource = {
        templateId: dto.preparation.templateId,
        templateVersion: dto.preparation.templateVersion,
        contactId: dto.preparation.contactId,
        contactVersion: dto.preparation.contactVersion,
        reviewScope: "internal-only" as const,
        legalReviewStatus: "unreviewed" as const,
        contactVerification: "unverified" as const,
      };
      const templateData = template.data as TemplatePreparationData;
      const contactData = contact.data as ContactPreparationData;
      preview.title = templateData.title;
      preview.body = templateData.body;
      preview.warning = `${preview.warning} Internally reviewed contact: ${contactData.displayName}.`;
    }

    const row = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(NoticeSnapshotEntity, {
          tenantId,
          entryId: dto.entryId,
          entryVersion: dto.entryVersion,
          language: dto.language,
          legalReviewStatus: "unreviewed",
          sourcePack: entry.sourcePack ?? null,
          preview,
          registerData: {
            name: entry.name,
            purposeEn: entry.purposeEn,
            purposeHi: entry.purposeHi,
            dataCategories: entry.dataCategories,
            storageLocation: entry.storageLocation,
            retentionNote: entry.retentionNote,
            contact: entry.contact,
            vendorReferences: entry.vendorReferences,
            storageReferences: entry.storageReferences,
            hasPaperRecords: entry.hasPaperRecords,
          },
          submittedBy: membership.userId,
          reviewVersion: 1,
          status: "in_review",
          decisions: [],
          preparationSource,
        }),
      );
      await this.evidence.append(manager, {
        tenantId,
        kind: "notice",
        sourceId: saved.id,
        version: saved.reviewVersion,
        action: "submit",
        status: saved.status,
        provenance: "recorded",
        actorId: membership.userId,
      });
      return saved;
    });
    return this.toView(row);
  }

  async decide(
    tenantId: string,
    id: string,
    dto: NoticeDecisionDto,
    membership: CurrentMembership,
  ): Promise<NoticeSnapshotView> {
    const row = await this.findOrThrow(tenantId, id);
    if (row.reviewVersion !== dto.version) {
      throw new ConflictException(
        "This notice changed since you last loaded it.",
      );
    }
    if (row.status !== "in_review") {
      throw new BadRequestException("Only a notice in review can be decided.");
    }
    if (dto.decision === "request_changes" && !dto.comment?.trim()) {
      throw new BadRequestException(
        "A comment is required to request changes.",
      );
    }
    if (dto.decision === "publish_sample" && !dto.sampleOnlyAcknowledged) {
      throw new BadRequestException(
        "Acknowledge this is a local sample publication only.",
      );
    }
    row.decisions = [
      ...row.decisions,
      {
        id: crypto.randomUUID(),
        version: row.reviewVersion,
        decision: dto.decision,
        comment: dto.comment ?? "",
        decidedAt: new Date().toISOString(),
        actorId: membership.userId,
      },
    ];
    row.status =
      dto.decision === "publish_sample"
        ? "sample_published"
        : "changes_requested";
    row.reviewVersion += 1;
    await this.dataSource.transaction(async (manager) => {
      await manager.save(row);
      await this.evidence.append(manager, {
        tenantId,
        kind: "notice_decision",
        sourceId: row.id,
        version: row.reviewVersion,
        action: dto.decision,
        status: row.status,
        provenance: "recorded",
        actorId: membership.userId,
      });
    });
    return this.toView(row);
  }

  async renderPdf(tenantId: string, id: string): Promise<Buffer> {
    return this.pdf.render(await this.findOrThrow(tenantId, id));
  }

  async renderQr(tenantId: string, id: string): Promise<Buffer> {
    await this.findOrThrow(tenantId, id);
    const url = `http://127.0.0.1:4200/workspace/${tenantId}/notices/${id}`;
    return QRCode.toBuffer(url, { type: "png", margin: 1, width: 256 });
  }

  private async findOrThrow(
    tenantId: string,
    id: string,
  ): Promise<NoticeSnapshotEntity> {
    const row = await this.snapshots.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Notice snapshot not found.");
    return row;
  }

  private toView(row: NoticeSnapshotEntity): NoticeSnapshotView {
    return {
      id: row.id,
      entryId: row.entryId,
      entryVersion: row.entryVersion,
      language: row.language,
      mode: "local-sample",
      legalReviewStatus: row.legalReviewStatus,
      sourcePack: row.sourcePack ?? undefined,
      preview: row.preview,
      registerData: row.registerData,
      submittedAt: row.submittedAt.toISOString(),
      submittedBy: row.submittedBy,
      reviewVersion: row.reviewVersion,
      status: row.status,
      decisions: row.decisions,
      preparationSource: row.preparationSource ?? undefined,
    };
  }
}
