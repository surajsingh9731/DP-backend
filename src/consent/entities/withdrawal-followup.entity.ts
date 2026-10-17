import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type WithdrawalFollowupStatus = "open" | "done";

/** The "erasure task" the brief requires within a minute of a withdrawal — a real row staff must act on, not just a log line. */
@Entity({ name: "withdrawal_followups" })
@Index(["tenantId", "status"])
export class WithdrawalFollowupEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  receiptId!: string;

  @Column({ type: "text", default: "open" })
  status!: WithdrawalFollowupStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
