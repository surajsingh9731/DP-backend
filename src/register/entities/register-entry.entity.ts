import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type LegalBasis = "consent" | "legitimate_use";
export type RegisterEntryStatus = "draft" | "published";

export interface VendorReference {
  name: string;
  service: string;
}

export interface StorageReference {
  name: string;
  location: string;
  medium: "digital" | "paper";
}

/** One row of the data register: what's collected, why, where it's kept, and under what legal basis. */
@Entity({ name: "register_entries" })
@Index(["tenantId"])
export class RegisterEntryEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  /** References a data category code from the tenant's active sector pack (see sector-packs module). */
  @Column({ type: "text" })
  categoryCode!: string;

  @Column({ type: "text" })
  purposeEn!: string;

  @Column({ type: "text" })
  purposeHi!: string;

  @Column({ type: "text" })
  legalBasis!: LegalBasis;

  /** True when the owner chose a legal basis other than the sector pack's default suggestion for this category. */
  @Column({ type: "boolean", default: false })
  legalBasisOverridden!: boolean;

  @Column({ type: "text", nullable: true })
  legalBasisReason!: string | null;

  @Column({ type: "int" })
  retentionDays!: number;

  @Column({ type: "boolean", default: false })
  hasPaperRecords!: boolean;

  @Column({ type: "jsonb", default: () => "'[]'" })
  vendorReferences!: VendorReference[];

  @Column({ type: "jsonb", default: () => "'[]'" })
  storageReferences!: StorageReference[];

  @Column({ type: "text", default: "draft" })
  status!: RegisterEntryStatus;

  @Column({ type: "int", default: 1 })
  version!: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
