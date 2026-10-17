import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type NoticeStatus = "draft" | "published";

export interface NoticePurpose {
  registerEntryId: string;
  purposeEn: string;
  purposeHi: string;
  categoryLabel: { en: string; hi: string };
}

/**
 * One row per tenant: the current notice (draft or published). History
 * lives in notice_versions. `status = 'published'` rows are openly
 * readable (see the Notices migration) — that's the actual public notice
 * a data principal reads with no login, by design, not a leak.
 */
@Entity({ name: "notices" })
@Index(["tenantId"], { unique: true })
export class NoticeEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "text" })
  titleEn!: string;

  @Column({ type: "text" })
  titleHi!: string;

  @Column({ type: "text" })
  bodyEn!: string;

  @Column({ type: "text" })
  bodyHi!: string;

  /** The itemised, structured purpose list the public consent form reads — see the NoticePurposes migration. */
  @Column({ type: "jsonb", default: () => "'[]'" })
  purposes!: NoticePurpose[];

  @Column({ type: "text", default: "draft" })
  status!: NoticeStatus;

  @Column({ type: "int", default: 1 })
  version!: number;

  @Column({ type: "timestamptz", nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
