import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "activity_log" })
@Index(["tenantId"])
export class ActivityLogEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid", nullable: true })
  actorUserId!: string | null;

  @Column({ type: "text" })
  action!: string;

  @Column({ type: "jsonb", default: () => "'{}'" })
  detail!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  occurredAt!: Date;
}
