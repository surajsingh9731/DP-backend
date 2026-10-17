import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type VendorAgreementStatus = "not_sent" | "sent" | "signed";

/** One third party the organisation shares data with — a processor agreement and its signing status, never the data itself. */
@Entity({ name: "vendors" })
@Index(["tenantId"])
export class VendorEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text" })
  serviceDescription!: string;

  @Column({ type: "text" })
  contactEmail!: string;

  @Column({ type: "text", default: "not_sent" })
  agreementStatus!: VendorAgreementStatus;

  @Column({ type: "timestamptz", nullable: true })
  agreementSentAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  agreementSignedAt!: Date | null;

  @Column({ type: "text", nullable: true })
  agreementDocumentRef!: string | null;

  @Column({ type: "int", default: 1 })
  version!: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
