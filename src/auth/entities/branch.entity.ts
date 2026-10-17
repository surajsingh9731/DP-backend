import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "branches" })
@Index(["tenantId"])
export class BranchEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "boolean", default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
