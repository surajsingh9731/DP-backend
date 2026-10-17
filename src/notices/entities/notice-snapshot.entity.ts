import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type {
  NoticeDecisionRecord,
  NoticeLegalReviewStatus,
  NoticePreparationSource,
  NoticePreview,
  NoticeSnapshotStatus,
  RegisterData,
  RegisterSourcePack,
} from "@sahmati/contracts";

/**
 * An immutable sample notice snapshot (module C). Once created, `preview`
 * and `registerData` never change — only `status`/`decisions` move, so a
 * reviewer is always looking at exactly the text that was submitted.
 */
@Entity({ name: "notice_snapshots" })
@Index(["tenantId"])
export class NoticeSnapshotEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  entryId!: string;

  @Column({ type: "int" })
  entryVersion!: number;

  @Column({ type: "text" })
  language!: "en" | "hi";

  @Column({ type: "text", default: "unreviewed" })
  legalReviewStatus!: NoticeLegalReviewStatus;

  @Column({ type: "jsonb", nullable: true })
  sourcePack!: RegisterSourcePack | null;

  @Column({ type: "jsonb" })
  preview!: NoticePreview;

  @Column({ type: "jsonb" })
  registerData!: RegisterData;

  @CreateDateColumn({ type: "timestamptz" })
  submittedAt!: Date;

  @Column({ type: "text" })
  submittedBy!: string;

  @Column({ type: "int", default: 1 })
  reviewVersion!: number;

  @Column({ type: "text", default: "in_review" })
  status!: NoticeSnapshotStatus;

  @Column({ type: "jsonb", default: () => "'[]'" })
  decisions!: NoticeDecisionRecord[];

  @Column({ type: "jsonb", nullable: true })
  preparationSource!: NoticePreparationSource | null;
}
