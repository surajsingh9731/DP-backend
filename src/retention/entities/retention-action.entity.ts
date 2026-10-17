import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/** A staff-attested record that a register entry's data has actually been erased. Append-only — an erasure is a historical fact, never edited. */
@Entity({ name: "retention_actions" })
@Index(["tenantId", "registerEntryId"])
export class RetentionActionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  registerEntryId!: string;

  @Column({ type: "text" })
  notes!: string;

  @Column({ type: "uuid" })
  executedByUserId!: string;

  @CreateDateColumn({ type: "timestamptz" })
  executedAt!: Date;
}
