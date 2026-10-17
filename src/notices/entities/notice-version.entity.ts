import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/** Append-only snapshot of every published notice version — the proof trail for "what did the notice say on date X". */
@Entity({ name: "notice_versions" })
@Index(["tenantId"])
export class NoticeVersionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "int" })
  version!: number;

  @Column({ type: "text" })
  titleEn!: string;

  @Column({ type: "text" })
  titleHi!: string;

  @Column({ type: "text" })
  bodyEn!: string;

  @Column({ type: "text" })
  bodyHi!: string;

  @Column({ type: "uuid" })
  publishedByUserId!: string;

  @CreateDateColumn({ type: "timestamptz" })
  publishedAt!: Date;
}
