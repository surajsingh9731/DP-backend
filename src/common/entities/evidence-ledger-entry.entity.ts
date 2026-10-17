import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { EvidenceKind, EvidenceProvenance } from "@sahmati/contracts";

/**
 * Single append-only ledger backing the cross-module Evidence hub (module L
 * support) and every feature's own immutable history/audit trail.
 *
 * Every feature service that performs a state-changing write appends one row
 * here in the SAME transaction as that write (see EvidenceLedgerService).
 * Nothing ever updates or deletes a row; `previousHash`/`eventHash` form a
 * per-source hash chain so a single-event comparison can be made, which is a
 * bounded integrity check — never proof of a full, tamper-proof history or of
 * external authenticity.
 */
@Entity({ name: "evidence_ledger_entries" })
@Index(["tenantId", "kind", "sourceId"])
@Index(["tenantId", "occurredAt"])
export class EvidenceLedgerEntryEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "text" })
  kind!: EvidenceKind;

  /** The id of the record this event is about (a notice id, task id, request id, ...). */
  @Column({ type: "uuid" })
  sourceId!: string;

  @Column({ type: "int" })
  version!: number;

  @Column({ type: "text" })
  action!: string;

  @Column({ type: "text" })
  status!: string;

  @Column({ type: "text" })
  provenance!: EvidenceProvenance;

  @Column({ type: "text", nullable: true })
  actorId!: string | null;

  @Column({ type: "text", nullable: true })
  note!: string | null;

  /** Reference labels only (e.g. "sample-evidence:receipt-1") — never fetched or authenticated. */
  @Column({ type: "jsonb", default: () => "'[]'" })
  evidenceRefs!: string[];

  /** Bounded, non-sensitive extra detail used to render evidence-hub facts/links. */
  @Column({ type: "jsonb", default: () => "'{}'" })
  detail!: Record<string, unknown>;

  @Column({ type: "text", nullable: true })
  previousHash!: string | null;

  @Column({ type: "text" })
  eventHash!: string;

  @CreateDateColumn({ type: "timestamptz" })
  occurredAt!: Date;

  /** Monotonic, gap-tolerant ordering key for cursor pagination — not a count. */
  @Generated("increment")
  @Column({ type: "bigint" })
  sequence!: string;
}
