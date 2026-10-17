import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

/** A branch/organisation workspace. Everything else is scoped to one of these. */
@Entity({ name: "tenants" })
export class TenantEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text" })
  branch!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
