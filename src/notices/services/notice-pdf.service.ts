import { Injectable } from '@nestjs/common';
import type { NoticeSnapshotEntity } from '../entities/notice-snapshot.entity';

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Renders a single-page sample-notice PDF with no external dependency. This
 * is intentionally minimal — a local sample export, not a typeset,
 * accessibility-tagged production document. The upstream bilingual text is
 * ASCII-transliterated where it is not, since this hand-rolled writer uses
 * the PDF base WinAnsi font only; a production exporter would embed a
 * Devanagari-capable font instead.
 */
@Injectable()
export class NoticePdfService {
  render(snapshot: NoticeSnapshotEntity): Buffer {
    const lines = [
      `Sahmati local sample notice (${snapshot.language.toUpperCase()})`,
      '',
      snapshot.preview.title,
      '',
      ...wrap(snapshot.preview.warning, 90),
      '',
      ...wrap(snapshot.preview.body, 90),
      '',
      `Status: ${snapshot.status} | Review version: ${snapshot.reviewVersion}`,
      `Snapshot: ${snapshot.id}`,
    ];

    const contentLines = lines
      .map((line, index) => {
        const y = 760 - index * 16;
        return `BT /F1 11 Tf 56 ${y} Td (${escapePdfText(line)}) Tj ET`;
      })
      .join('\n');
    const content = `${contentLines}\n`;

    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((body, index) => {
      offsets.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
      pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'latin1');
  }
}
