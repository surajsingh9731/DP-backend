import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * Dedupe record for the retention scheduler: once a register entry's
 * overdue state has been alerted to the owner, it's never alerted again
 * on the next poll tick — only a fresh `RetentionActionEntity` (an actual
 * erasure) or a hold clears the underlying overdue state, not this row.
 */
@Entity({ name: "retention_alerts" })
@Index(["tenantId", "registerEntryId"], { unique: true })
export class RetentionAlertEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  registerEntryId!: string;

  @CreateDateColumn({ type: "timestamptz" })
  raisedAt!: Date;
}
