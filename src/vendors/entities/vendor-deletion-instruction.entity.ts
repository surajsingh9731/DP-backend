import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type VendorDeletionInstructionStatus =
  "pending" | "acknowledged" | "declared_complete" | "failed";

/**
 * One deletion instruction sent to a vendor for a specific register entry's
 * data. Status vocabulary deliberately mirrors the brief's evidence model:
 * an "acknowledged" instruction proves the vendor acknowledged receiving
 * it, nothing more; "declared_complete" is a staff/vendor attestation,
 * never a system-verified fact — there is no supported integration in R2
 * that could make that distinction honestly, so it is never claimed.
 */
@Entity({ name: "vendor_deletion_instructions" })
@Index(["tenantId", "vendorId"])
export class VendorDeletionInstructionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  vendorId!: string;

  @Column({ type: "uuid" })
  registerEntryId!: string;

  @Column({ type: "text" })
  instructionText!: string;

  @Column({ type: "text", default: "pending" })
  status!: VendorDeletionInstructionStatus;

  @Column({ type: "timestamptz", nullable: true })
  acknowledgedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: "text", nullable: true })
  evidenceNote!: string | null;

  @Column({ type: "int", default: 1 })
  version!: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
