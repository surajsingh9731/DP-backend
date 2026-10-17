import { ConflictException, Injectable } from '@nestjs/common';
import type {
  TenantScope,
  NoticePreparationInput,
  NoticePreparationSource,
  TemplatePreparationData,
  ContactPreparationData,
  SourcePack,
} from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { PreparationRepository } from './preparation.repository.js';
import { PREPARATION_STATUS } from '../constants/preparation.constants.js';
@Injectable()
export class PreparationSelectionService {
  constructor(private readonly repository: PreparationRepository) {}
  async resolve(
    client: DatabaseClient,
    scope: TenantScope,
    selected: NoticePreparationInput,
    language: 'en' | 'hi',
    pack?: SourcePack,
  ) {
    const template = await this.repository.record(client, scope, selected.templateId, true);
    const contact = await this.repository.record(client, scope, selected.contactId, true);
    if (
      !template ||
      !contact ||
      template.kind !== 'template' ||
      contact.kind !== 'contact' ||
      template.version !== selected.templateVersion ||
      contact.version !== selected.contactVersion ||
      template.status !== PREPARATION_STATUS.reviewed ||
      contact.status !== PREPARATION_STATUS.reviewed
    )
      throw new ConflictException(
        'Select current internally reviewed template and contact versions.',
      );
    const data = template.data as TemplatePreparationData;
    if (
      data.language !== language ||
      (template.sourcePack &&
        (pack?.id !== template.sourcePack.id || pack.version !== template.sourcePack.version))
    )
      throw new ConflictException(
        'Template language/source pack does not match this saved register.',
      );
    const source: NoticePreparationSource = {
      ...selected,
      reviewScope: 'internal-only',
      legalReviewStatus: 'unreviewed',
      contactVerification: 'unverified',
    };
    return { source, template: data, contact: contact.data as ContactPreparationData };
  }
}
