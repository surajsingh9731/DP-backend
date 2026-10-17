import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { CheckEvaluationItem } from "@sahmati/contracts";

/** A computed snapshot combining the followup task's state and its latest manual review. */
@Entity({ name: "check_evaluations" })
@Index(["taskId"])
export class CheckEvaluationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  taskId!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "int" })
  taskVersion!: number;

  @Column({ type: "int" })
  reviewVersion!: number;

  @CreateDateColumn({ type: "timestamptz" })
  computedAt!: Date;

  @Column({ type: "text" })
  computedBy!: string;

  @Column({ type: "jsonb" })
  checks!: CheckEvaluationItem[];

  @Column({ type: "text" })
  contentHash!: string;

  @Column({ type: "text", default: "local-sample" })
  mode!: "local-sample";
}
