import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'workspace', name: 'organisations' })
export class OrganisationEntity {
  @PrimaryColumn('uuid', { name: 'id' }) id!: string;
  @Column('text', { name: 'name' }) name!: string;
  @Column('text', { name: 'slug' }) slug!: string;
}
