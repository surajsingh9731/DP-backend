import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type TrainingProgressStatus =
  "not_started" | "in_progress" | "completed";

/** One staff member's progress through one lesson in this organisation. */
@Entity({ name: "training_progress" })
@Index(["tenantId", "userId", "lessonCode"], { unique: true })
export class TrainingProgressEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "text" })
  lessonCode!: string;

  @Column({ type: "text", default: "not_started" })
  status!: TrainingProgressStatus;

  @Column({ type: "int", nullable: true })
  quizScore!: number | null;

  @Column({ type: "uuid", nullable: true })
  certificateId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  startedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
