import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A signed-in session. The cookie carries only this row's id; `tokenHash` is
 * checked against a hash of that id plus the local auth pepper so a stolen
 * database row alone cannot be replayed as a cookie, and vice versa.
 */
@Entity({ name: 'sessions' })
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
