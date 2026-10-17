import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type RetentionHoldStatus = "active" | "released";

/** Pauses the retention clock on one register entry — a legal hold, an open grievance, an ongoing audit. */
@Entity({ name: "retention_holds" })
@Index(["tenantId", "registerEntryId"])
export class RetentionHoldEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  registerEntryId!: string;

  @Column({ type: "text" })
  reason!: string;

  @Column({ type: "text", default: "active" })
  status!: RetentionHoldStatus;

  @Column({ type: "uuid" })
  placedByUserId!: string;

  @CreateDateColumn({ type: "timestamptz" })
  placedAt!: Date;

  @Column({ type: "uuid", nullable: true })
  releasedByUserId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  releasedAt!: Date | null;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
