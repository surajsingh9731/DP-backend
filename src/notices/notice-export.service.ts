import {
  NOTICE_STATUS,
  NOTICE_MODE,
  NOTICE_LEGAL_REVIEW_STATUS,
} from '../constants/notices.constants.js';
import { WORKSPACE_ROLES } from '../constants/security.constants.js';
import {
  ConflictException,
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import * as fontkit from 'fontkit';
import type { TenantScope } from '@sahmati/contracts';
import type { NoticeExportSource } from './models/notice-export.model.js';
import { NOTICE_EXPORT_POLICY, DEVANAGARI_RUNS } from '../constants/notice-export.constants.js';
import { NOTICE_EXPORT_EN } from './export-locales/en.js';
import { NOTICE_EXPORT_HI } from './export-locales/hi.js';

@Injectable()
export class NoticeExportService {
  private readonly fontDirectory = resolve(process.cwd(), 'assets/fonts');
  private readonly latin = readFileSync(resolve(this.fontDirectory, 'NotoSans-Regular.ttf'));
  private readonly devanagari = readFileSync(
    resolve(this.fontDirectory, 'NotoSansDevanagari-Regular.ttf'),
  );
  private readonly latinCoverage = fontkit.create(this.latin) as fontkit.Font;
  private readonly devanagariCoverage = fontkit.create(this.devanagari) as fontkit.Font;
  constructor(private readonly config: ConfigService) {}

  private assertSample(scope: TenantScope, source: NoticeExportSource): void {
    if (scope.role !== WORKSPACE_ROLES.owner)
      throw new ForbiddenException('Only an owner can export local sample notices.');
    if (
      source.status !== NOTICE_STATUS.samplePublished ||
      source.mode !== NOTICE_MODE ||
      source.legalReviewStatus !== NOTICE_LEGAL_REVIEW_STATUS
    )
      throw new ConflictException(
        'Only internally sample-published, unreviewed snapshots can be exported.',
      );
  }
  private localUrl(scope: TenantScope, source: NoticeExportSource): string {
    const origin = this.config.getOrThrow<string>('webOrigin');
    const base = new URL(origin);
    if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.port !== '4200')
      throw new ConflictException('Only the configured local sample origin is supported.');
    return `${base.origin}/workspace/${encodeURIComponent(scope.tenantId)}/notices/${encodeURIComponent(source.id)}`;
  }
  async qr(scope: TenantScope, source: NoticeExportSource): Promise<Buffer> {
    this.assertSample(scope, source);
    return QRCode.toBuffer(this.localUrl(scope, source), {
      type: 'png',
      errorCorrectionLevel: 'M',
      width: NOTICE_EXPORT_POLICY.qrWidth,
      margin: 4,
    });
  }
  private text(document: PDFKit.PDFDocument, value: string, size: number): void {
    const parts = value.split(DEVANAGARI_RUNS).filter(Boolean);
    if (!parts.length) {
      document.moveDown();
      return;
    }
    for (const [index, part] of parts.entries()) {
      const devanagari = /\p{Script_Extensions=Devanagari}/u.test(part);
      const coverage = devanagari ? this.devanagariCoverage : this.latinCoverage;
      for (const character of part) {
        if (
          !/\s|\u200c|\u200d/u.test(character) &&
          !coverage.hasGlyphForCodePoint(character.codePointAt(0)!)
        )
          throw new BadRequestException(
            'The PDF font cannot render some characters. Use the text preview or supported English/Hindi text.',
          );
      }
      document
        .font(devanagari ? 'devanagari' : 'latin')
        .fontSize(size)
        .text(part, { continued: index < parts.length - 1, lineGap: NOTICE_EXPORT_POLICY.lineGap });
    }
  }
  async pdf(scope: TenantScope, source: NoticeExportSource): Promise<Buffer> {
    this.assertSample(scope, source);
    const copy = source.preview.language === 'hi' ? NOTICE_EXPORT_HI : NOTICE_EXPORT_EN;
    const document = new PDFDocument({
      size: 'A4',
      margins: { top: 76, bottom: 76, left: 48, right: 48 },
      bufferPages: true,
      info: {
        Title: 'Sahmati local sample notice',
        Author: 'Sahmati local preview',
        Subject: 'Unreviewed local demonstration; not a production notice',
      },
    });
    document.registerFont('latin', this.latin).registerFont('devanagari', this.devanagari);
    const chunks: Buffer[] = [];
    const completed = new Promise<Buffer>((resolveBuffer, reject) => {
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolveBuffer(Buffer.concat(chunks)));
      document.on('error', reject);
    });
    try {
      document.fillColor(NOTICE_EXPORT_POLICY.ink);
      this.text(document, copy.title, 21);
      document.moveDown(0.4);
      this.text(document, source.preview.title, 17);
      document.moveDown(0.5);
      this.text(document, `${copy.version}: ${source.entryVersion}`, 11);
      if (source.preview.sourcePack)
        this.text(
          document,
          `${copy.pack}: ${source.preview.sourcePack.id} / ${source.preview.sourcePack.version}`,
          11,
        );
      document.moveDown(0.5);
      document.fillColor(NOTICE_EXPORT_POLICY.warning);
      this.text(document, copy.warning, 12);
      document.moveDown(0.4);
      this.text(document, source.preview.warning, 12);
      document.moveDown(0.8);
      document.fillColor(NOTICE_EXPORT_POLICY.ink);
      for (const paragraph of source.preview.body.split('\n')) {
        this.text(document, paragraph, 13);
        document.moveDown(0.35);
      }
      if (document.y + 180 > document.page.height - document.page.margins.bottom)
        document.addPage();
      document.moveDown(0.5);
      this.text(document, copy.qrLabel, 11);
      const image = await this.qr(scope, source);
      document.image(image, document.page.margins.left, document.y, { width: 100 });
      document.y += 108;
      this.text(document, copy.localOnly, 10);
      const pages = document.bufferedPageRange();
      for (let page = 0; page < pages.count; page++) {
        document.switchToPage(page);
        document
          .font('latin')
          .fontSize(9)
          .fillColor(NOTICE_EXPORT_POLICY.warning)
          .text('SAHMATI | LOCAL SAMPLE | NOT LEGALLY REVIEWED', 48, 28, { lineBreak: false });
        document
          .fontSize(8)
          .fillColor(NOTICE_EXPORT_POLICY.ink)
          .text(`${source.id} | ${page + 1}/${pages.count}`, 48, document.page.height - 40, {
            lineBreak: false,
          });
      }
      document.end();
      return await completed;
    } catch (error) {
      document.destroy(error instanceof Error ? error : new Error('Export failed'));
      await completed.catch(() => undefined);
      throw error;
    }
  }
}
