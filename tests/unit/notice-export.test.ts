import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import type { TenantScope } from '@sahmati/contracts';
import { NoticeExportService } from '../../src/notices/notice-export.service.js';
import type { NoticeExportSource } from '../../src/notices/models/notice-export.model.js';
const scope: TenantScope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  branchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: '00000000-0000-4000-8000-000000000001',
  role: 'owner',
};
const source: NoticeExportSource = {
  id: '99999999-9999-4999-8999-999999999999',
  entryVersion: 2,
  status: 'sample_published',
  mode: 'local-sample',
  legalReviewStatus: 'unreviewed',
  preview: {
    entryId: '88888888-8888-4888-8888-888888888888',
    version: 2,
    language: 'en',
    status: 'unreviewed-draft',
    title: 'Synthetic admissions notice',
    warning: 'Sample only. Not legally reviewed.',
    body: 'Purpose: Prepare a synthetic admissions draft.\nContact: owner@demo.sahmati.test',
    sourcePack: { id: 'education', version: 1, reviewStatus: 'unreviewed' },
  },
};
const service = () =>
  new NoticeExportService(new ConfigService({ webOrigin: 'http://127.0.0.1:4200' }));
test('PDF/QR exports reserve explicit sample state and export capability to owner', async () => {
  for (const role of ['staff', 'viewer'] as const) {
    await assert.rejects(service().qr({ ...scope, role }, source), { status: 403 });
    await assert.rejects(service().pdf({ ...scope, role }, source), { status: 403 });
  }
  await assert.rejects(service().qr(scope, { ...source, status: 'in_review' }), { status: 409 });
  await assert.rejects(service().pdf(scope, { ...source, status: 'changes_requested' }), {
    status: 409,
  });
});
test('QR decodes to the exact local authenticated snapshot route and contains no notice body', async () => {
  const image = PNG.sync.read(await service().qr(scope, source));
  const decoded = jsQR.default(new Uint8ClampedArray(image.data), image.width, image.height);
  assert.equal(
    decoded?.data,
    `http://127.0.0.1:4200/workspace/${scope.tenantId}/notices/${source.id}`,
  );
  assert.ok(!decoded?.data.includes('owner@'));
  const remote = new NoticeExportService(
    new ConfigService({ webOrigin: 'https://example.invalid' }),
  );
  await assert.rejects(remote.qr(scope, source), { status: 409 });
});
test('PDF renderer embeds English/Hindi fonts and rejects missing glyphs instead of silent boxes', async () => {
  const en = await service().pdf(scope, source);
  assert.equal(en.subarray(0, 4).toString(), '%PDF');
  assert.ok(en.length > 5000);
  const hi = await service().pdf(scope, {
    ...source,
    preview: {
      ...source.preview,
      language: 'hi',
      title: 'नमूना प्रवेश सूचना',
      warning: 'केवल नमूना। कानूनी समीक्षा नहीं हुई है।',
      body: 'उद्देश्य: काल्पनिक प्रवेश पूछताछ का प्रबंधन।\nसंपर्क: owner@demo.sahmati.test',
    },
  });
  assert.equal(hi.subarray(0, 4).toString(), '%PDF');
  assert.ok(hi.length > 5000);
  await assert.rejects(
    service().pdf(scope, {
      ...source,
      preview: { ...source.preview, title: 'Unsupported glyph 🧑' },
    }),
    { status: 400 },
  );
});
