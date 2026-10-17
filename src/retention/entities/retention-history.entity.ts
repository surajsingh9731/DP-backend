import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/** Shared immutable history for both policy and hold records. */
@Entity({ name: "retention_history" })
@Index(["recordType", "recordId"])
export class RetentionHistoryEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "text" })
  recordType!: "policy" | "hold";

  @Column({ type: "uuid" })
  recordId!: string;

  @Column({ type: "int" })
  version!: number;

  @Column({ type: "text" })
  action!: string;

  @Column({ type: "text" })
  reason!: string;

  @Column({ type: "text" })
  actorId!: string;

  @CreateDateColumn({ type: "timestamptz" })
  at!: Date;
}
