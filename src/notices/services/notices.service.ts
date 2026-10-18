import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { NoticeView, PublicNoticeView } from "@sahmati/contracts";
import { OrganisationEntity } from "../../auth/entities/organisation.entity";
import { RegisterEntryEntity } from "../../register/entities/register-entry.entity";
import { NoticeEntity } from "../entities/notice.entity";
import { NoticeVersionEntity } from "../entities/notice-version.entity";
import { PublishNoticeDto } from "../dto/publish-notice.dto";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { IdempotencyService } from "../../common/services/idempotency.service";
import { SectorPackRegistryService } from "../../sector-packs/services/sector-pack-registry.service";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Injectable()
export class NoticesService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly idempotency: IdempotencyService,
    private readonly sectorPacks: SectorPackRegistryService,
  ) {}

  async current(): Promise<NoticeView | null> {
    const row = await this.tenantContext
      .repo(NoticeEntity)
      .findOne({ where: { tenantId: this.tenantId() } });
    return row ? this.toView(row) : null;
  }

  async publish(
    dto: PublishNoticeDto,
    session: AuthenticatedSession,
  ): Promise<NoticeView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const entries = await manager
          .getRepository(RegisterEntryEntity)
          .find({ where: { tenantId } });
        if (entries.length === 0) {
          throw new BadRequestException(
            "Add at least one entry to your data register before publishing a notice.",
          );
        }
        const organisation = await manager
          .getRepository(OrganisationEntity)
          .findOne({ where: { id: tenantId } });
        if (!organisation)
          throw new NotFoundException("Organisation not found.");
        const pack = this.sectorPacks.getActive(organisation.sectorPackCode);

        const categoriesEn = [
          ...new Set(
            entries.map((e) => this.categoryLabel(pack, e.categoryCode).en),
          ),
        ];
        const categoriesHi = [
          ...new Set(
            entries.map((e) => this.categoryLabel(pack, e.categoryCode).hi),
          ),
        ];
        const purposesEn = [...new Set(entries.map((e) => e.purposeEn))];
        const purposesHi = [...new Set(entries.map((e) => e.purposeHi))];
        const purposes = entries.map((entry) => ({
          registerEntryId: entry.id,
          purposeEn: entry.purposeEn,
          purposeHi: entry.purposeHi,
          categoryLabel: this.categoryLabel(pack, entry.categoryCode),
        }));

        const bodyEn = pack.noticeClauses.en
          .replace("{{categories}}", categoriesEn.join(", "))
          .replace("{{purposes}}", purposesEn.join(", "));
        const bodyHi = pack.noticeClauses.hi
          .replace("{{categories}}", categoriesHi.join(", "))
          .replace("{{purposes}}", purposesHi.join(", "));

        let notice = await manager
          .getRepository(NoticeEntity)
          .findOne({ where: { tenantId } });
        const publishedAt = new Date();
        if (notice) {
          notice.titleEn = `Privacy notice — ${organisation.name}`;
          notice.titleHi = `गोपनीयता सूचना — ${organisation.name}`;
          notice.bodyEn = bodyEn;
          notice.bodyHi = bodyHi;
          notice.purposes = purposes;
          notice.status = "published";
          notice.version += 1;
          notice.publishedAt = publishedAt;
          await manager.save(notice);
        } else {
          notice = await manager.save(
            manager.create(NoticeEntity, {
              tenantId,
              titleEn: `Privacy notice — ${organisation.name}`,
              titleHi: `गोपनीयता सूचना — ${organisation.name}`,
              bodyEn,
              bodyHi,
              purposes,
              status: "published",
              version: 1,
              publishedAt,
            }),
          );
        }

        await manager.save(
          manager.create(NoticeVersionEntity, {
            tenantId,
            version: notice.version,
            titleEn: notice.titleEn,
            titleHi: notice.titleHi,
            bodyEn: notice.bodyEn,
            bodyHi: notice.bodyHi,
            purposes: notice.purposes,
            publishedByUserId: session.userId,
            publishedAt,
          }),
        );

        if (!organisation.noticePublished) {
          organisation.noticePublished = true;
          await manager.save(organisation);
        }

        return this.toView(notice);
      },
    );
  }

  /**
   * The public, no-login notice page. Reads via the default (no tenant
   * context) connection — safe only because `notices` carries a
   * `status = 'published'` open-read policy (see the Notices migration);
   * nothing here ever calls setTenantId, so a draft notice or any other
   * tenant-scoped table stays unreachable from this path.
   */
  async publicNoticeBySlug(slug: string): Promise<PublicNoticeView> {
    const manager = this.tenantContext.manager;
    const organisation = await manager
      .getRepository(OrganisationEntity)
      .findOne({ where: { slug } });
    if (!organisation) return { available: false };

    const notice = await manager
      .getRepository(NoticeEntity)
      .findOne({ where: { tenantId: organisation.id, status: "published" } });
    if (!notice) return { available: false };

    return {
      available: true,
      organisationName: organisation.name,
      titleEn: notice.titleEn,
      titleHi: notice.titleHi,
      bodyEn: notice.bodyEn,
      bodyHi: notice.bodyHi,
      publishedAt: notice.publishedAt?.toISOString(),
      contactName: organisation.contactName,
      contactRole: organisation.contactRole,
      contactPhone: organisation.contactPhone,
      contactEmail: organisation.contactEmail,
    };
  }

  /**
   * The published notice's itemised purposes — what the consent form
   * actually offers. Reads the current tenant-scoped notice (used once a
   * tenant context is resolved, staff or verified participant alike).
   */
  async publishedPurposesForTenant(
    tenantId: string,
  ): Promise<NoticeEntity["purposes"]> {
    const notice = await this.tenantContext.manager
      .getRepository(NoticeEntity)
      .findOne({ where: { tenantId, status: "published" } });
    return notice?.purposes ?? [];
  }

  /**
   * Same purposes list, resolved by public org slug with no tenant
   * context at all — for showing the consent form before OTP
   * verification. Safe for the same reason as publicNoticeBySlug: reads
   * only ever touch the `status = 'published'` open-read rows.
   */
  async publicOfferBySlug(
    slug: string,
  ): Promise<{ available: boolean; purposes: NoticeEntity["purposes"] }> {
    const manager = this.tenantContext.manager;
    const organisation = await manager
      .getRepository(OrganisationEntity)
      .findOne({ where: { slug } });
    if (!organisation) return { available: false, purposes: [] };
    const notice = await manager
      .getRepository(NoticeEntity)
      .findOne({ where: { tenantId: organisation.id, status: "published" } });
    if (!notice) return { available: false, purposes: [] };
    return { available: true, purposes: notice.purposes };
  }

  private categoryLabel(
    pack: ReturnType<SectorPackRegistryService["getActive"]>,
    code: string,
  ) {
    return (
      pack.dataCategories.find((c) => c.code === code)?.label ?? {
        en: code,
        hi: code,
      }
    );
  }

  private tenantId(): string {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId)
      throw new Error(
        "No tenant context — this endpoint requires an authenticated session.",
      );
    return tenantId;
  }

  private toView(row: NoticeEntity): NoticeView {
    return {
      titleEn: row.titleEn,
      titleHi: row.titleHi,
      bodyEn: row.bodyEn,
      bodyHi: row.bodyHi,
      status: row.status,
      version: row.version,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }
}
