import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'identity', name: 'users' })
export class UserEntity {
  @PrimaryColumn('uuid', { name: 'id' }) id!: string;
  @Column('text', { name: 'email' }) email!: string;
  @Column('text', { name: 'display_name' }) displayName!: string;
  @Column('boolean', { name: 'active', default: true }) active!: boolean;
}
