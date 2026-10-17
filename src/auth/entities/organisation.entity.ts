import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/** The tenant root. See docs/architecture/R1-system-design.md §3 for why this table alone has a public-read RLS policy. */
@Entity({ name: "organisations" })
export class OrganisationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  name!: string;

  @Index({ unique: true })
  @Column({ type: "text" })
  slug!: string;

  @Column({ type: "text" })
  sectorPackCode!: string;

  @Column({ type: "int" })
  sectorPackVersion!: number;

  @Column({ type: "boolean", default: false })
  noticePublished!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
