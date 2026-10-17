import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from '../../src/register/dto/register.dto.js';
import { cleanRegisterData } from '../../src/register/register.validation.js';
const base = {
  name: 'Sample activity',
  purposeEn: 'Synthetic purpose',
  purposeHi: 'काल्पनिक उद्देश्य',
  dataCategories: ['Reference'],
  storageLocation: 'Declared storage',
  retentionNote: 'Pending decision',
  contact: 'Local owner',
};
const dto = (extra: Record<string, unknown>) => plainToInstance(RegisterDto, { ...base, ...extra });
const errors = (extra: Record<string, unknown>) =>
  validateSync(dto(extra), { whitelist: true, forbidNonWhitelisted: true });
test('optional references preserve legacy payload and retain deliberate false/empty values', () => {
  assert.deepEqual(cleanRegisterData(dto({})), base);
  assert.deepEqual(
    cleanRegisterData(dto({ hasPaperRecords: false, vendorReferences: [], storageReferences: [] })),
    { ...base, hasPaperRecords: false, vendorReferences: [], storageReferences: [] },
  );
  assert.equal(errors({ hasPaperRecords: true }).length, 0);
});
test('reference DTO rejects nulls, malformed arrays, unknown tags, extra fields and exceeded bounds', () => {
  const vendor = { name: 'Synthetic vendor', service: 'Document hosting' },
    storage = { name: 'Reference', medium: 'digital', location: 'Local synthetic system' };
  for (const invalid of [
    { vendorReferences: null },
    { storageReferences: null },
    { hasPaperRecords: null },
    { hasPaperRecords: 'true' },
    { vendorReferences: 'vendor' },
    { vendorReferences: [[]] },
    { storageReferences: [[]] },
    { vendorReferences: [null] },
    { vendorReferences: [{ ...vendor, verified: true }] },
    { storageReferences: [{ ...storage, verified: true }] },
    { storageReferences: [{ ...storage, medium: 'cloud' }] },
    { vendorReferences: [{ ...vendor, name: 'x'.repeat(101) }] },
    { vendorReferences: [{ ...vendor, service: 'x'.repeat(201) }] },
    { storageReferences: [{ ...storage, location: 'x'.repeat(201) }] },
    { vendorReferences: Array.from({ length: 11 }, () => vendor) },
    { storageReferences: Array.from({ length: 11 }, () => storage) },
  ])
    assert.ok(errors(invalid).length > 0, JSON.stringify(invalid));
});
test('references trim values, reject normalized duplicates and contradictory paper classification', () => {
  const cleaned = cleanRegisterData(
    dto({
      vendorReferences: [{ name: ' Vendor ', service: ' Hosting ' }],
      storageReferences: [{ name: ' Cabinet ', medium: 'paper', location: ' Room A ' }],
      hasPaperRecords: true,
    }),
  );
  assert.deepEqual(cleaned.vendorReferences, [{ name: 'Vendor', service: 'Hosting' }]);
  assert.deepEqual(cleaned.storageReferences, [
    { name: 'Cabinet', medium: 'paper', location: 'Room A' },
  ]);
  for (const invalid of [
    { vendorReferences: [{ name: ' ', service: 'Hosting' }] },
    { storageReferences: [{ name: 'Cabinet', medium: 'paper', location: ' ' }] },
    {
      vendorReferences: [
        { name: 'Vendor A', service: 'Hosting' },
        { name: 'vendor  a', service: 'HOSTING' },
      ],
    },
    {
      storageReferences: [
        { name: 'Room A', medium: 'digital', location: 'Local system' },
        { name: 'room  a', medium: 'digital', location: 'LOCAL SYSTEM' },
      ],
    },
    {
      hasPaperRecords: false,
      storageReferences: [{ name: 'Cabinet', medium: 'paper', location: 'Room A' }],
    },
  ])
    assert.throws(() => cleanRegisterData(dto(invalid)));
});
