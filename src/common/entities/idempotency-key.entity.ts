import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "idempotency_keys" })
@Index(["tenantId", "key"], { unique: true })
export class IdempotencyKeyEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "text" })
  key!: string;

  @Column({ type: "jsonb" })
  response!: unknown;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
