import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "evidence_ledger_entries" })
@Index(["tenantId", "createdAt"])
export class EvidenceLedgerEntryEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "text" })
  kind!: string;

  @Column({ type: "uuid" })
  sourceId!: string;

  @Column({ type: "text" })
  action!: string;

  @Column({ type: "text" })
  status!: string;

  @Column({ type: "uuid", nullable: true })
  actorId!: string | null;

  @Column({ type: "text" })
  provenance!: "recorded" | "declared" | "system_verified";

  @Column({ type: "text", nullable: true })
  previousHash!: string | null;

  @Column({ type: "text" })
  eventHash!: string;

  @Column({ type: "timestamptz" })
  occurredAt!: Date;

  @Column({ type: "timestamptz", default: () => "now()" })
  createdAt!: Date;
}
