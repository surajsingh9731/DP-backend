import type { NoticePreview, RegisterData, SourcePack } from '@sahmati/contracts';
import { REGISTER_EN } from './locales/en.js';
import { REGISTER_HI } from './locales/hi.js';
export function renderNoticePreview(
  data: RegisterData,
  id: string,
  version: number,
  language: 'en' | 'hi',
  sourcePack?: SourcePack,
): NoticePreview {
  const copy = language === 'hi' ? REGISTER_HI : REGISTER_EN;
  // Internal vendor/storage references never become notice copy implicitly.
  const body = `${copy.purpose}: ${language === 'hi' ? data.purposeHi : data.purposeEn}\n${copy.categories}: ${data.dataCategories.join(', ')}\n${copy.storage}: ${data.storageLocation}\n${copy.retention}: ${data.retentionNote}\n${copy.contact}: ${data.contact}`;
  return {
    ...(sourcePack ? { sourcePack } : {}),
    entryId: id,
    version,
    language,
    status: 'unreviewed-draft',
    title: data.name,
    warning: copy.warning,
    body,
  };
}
