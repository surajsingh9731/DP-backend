import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  NoticePreview,
  RegisterData,
  RegisterRevision,
  RegisterSourcePack,
  RegisterView,
} from '@sahmati/contracts';
import { RegisterEntryEntity } from '../entities/register-entry.entity';
import { RegisterRevisionEntity } from '../entities/register-revision.entity';
import { RegisterDataDto } from '../dto/register-data.dto';

@Injectable()
export class RegisterService {
  constructor(
    @InjectRepository(RegisterEntryEntity) private readonly entries: Repository<RegisterEntryEntity>,
    @InjectRepository(RegisterRevisionEntity)
    private readonly revisions: Repository<RegisterRevisionEntity>,
  ) {}

  async list(tenantId: string): Promise<RegisterView[]> {
    const rows = await this.entries.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
    return rows.map((row) => this.toView(row));
  }

  async create(
    tenantId: string,
    data: RegisterDataDto,
    sourcePack: RegisterSourcePack | null = null,
  ): Promise<RegisterView> {
    const entry = await this.entries.save(
      this.entries.create({ tenantId, version: 1, status: 'draft', sourcePack, ...this.fields(data) }),
    );
    await this.saveRevision(entry);
    return this.toView(entry);
  }

  async update(
    tenantId: string,
    id: string,
    expectedVersion: number,
    data: RegisterDataDto,
  ): Promise<RegisterView> {
    const entry = await this.entries.findOne({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Register entry not found.');
    if (entry.version !== expectedVersion) {
      throw new ConflictException('This entry changed since you last loaded it.');
    }
    Object.assign(entry, this.fields(data));
    entry.version += 1;
    await this.entries.save(entry);
    await this.saveRevision(entry);
    return this.toView(entry);
  }

  async history(tenantId: string, id: string): Promise<RegisterRevision[]> {
    const entry = await this.entries.findOne({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Register entry not found.');
    const rows = await this.revisions.find({ where: { entryId: id }, order: { version: 'ASC' } });
    return rows.map((row) => ({
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      data: row.data,
    }));
  }

  async noticePreview(tenantId: string, id: string, language: 'en' | 'hi'): Promise<NoticePreview> {
    const entry = await this.entries.findOne({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Register entry not found.');
    const purpose = language === 'hi' ? entry.purposeHi : entry.purposeEn;
    const categories = entry.dataCategories.join(language === 'hi' ? ', ' : ', ');
    return {
      entryId: entry.id,
      version: entry.version,
      language,
      status: 'unreviewed-draft',
      title: entry.name,
      warning:
        language === 'hi'
          ? 'अपुष्ट स्थानीय नमूना मसौदा। यह कानूनी रूप से समीक्षित सूचना नहीं है।'
          : 'Unreviewed local sample draft. This is not a legally reviewed notice.',
      body:
        language === 'hi'
          ? `उद्देश्य: ${purpose}. डेटा श्रेणियां: ${categories}. संग्रहण: ${entry.storageLocation}. संपर्क: ${entry.contact}.`
          : `Purpose: ${purpose}. Data categories: ${categories}. Storage: ${entry.storageLocation}. Contact: ${entry.contact}.`,
      sourcePack: entry.sourcePack,
    };
  }

  private fields(data: RegisterDataDto) {
    return {
      name: data.name,
      purposeEn: data.purposeEn,
      purposeHi: data.purposeHi,
      dataCategories: data.dataCategories,
      storageLocation: data.storageLocation,
      retentionNote: data.retentionNote,
      contact: data.contact,
      vendorReferences: data.vendorReferences ?? [],
      storageReferences: data.storageReferences ?? [],
      hasPaperRecords: data.hasPaperRecords ?? false,
    };
  }

  private async saveRevision(entry: RegisterEntryEntity): Promise<void> {
    await this.revisions.save(
      this.revisions.create({
        entryId: entry.id,
        tenantId: entry.tenantId,
        version: entry.version,
        data: this.toData(entry),
      }),
    );
  }

  private toData(entry: RegisterEntryEntity): RegisterData {
    return {
      name: entry.name,
      purposeEn: entry.purposeEn,
      purposeHi: entry.purposeHi,
      dataCategories: entry.dataCategories,
      storageLocation: entry.storageLocation,
      retentionNote: entry.retentionNote,
      contact: entry.contact,
      vendorReferences: entry.vendorReferences,
      storageReferences: entry.storageReferences,
      hasPaperRecords: entry.hasPaperRecords,
    };
  }

  private toView(entry: RegisterEntryEntity): RegisterView {
    return {
      id: entry.id,
      version: entry.version,
      status: entry.status,
      ...this.toData(entry),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      sourcePack: entry.sourcePack,
    };
  }
}
