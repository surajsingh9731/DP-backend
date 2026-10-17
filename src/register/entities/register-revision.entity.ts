import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/** Append-only snapshot history for a register entry — not the evidence ledger (this is internal setup data, not a compliance action), but it must never be edited after the fact either. */
@Entity({ name: "register_revisions" })
@Index(["tenantId", "entryId"])
export class RegisterRevisionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  entryId!: string;

  @Column({ type: "int" })
  version!: number;

  @Column({ type: "text" })
  action!: "created" | "updated" | "published";

  @Column({ type: "uuid" })
  actorUserId!: string;

  @Column({ type: "jsonb" })
  snapshot!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
