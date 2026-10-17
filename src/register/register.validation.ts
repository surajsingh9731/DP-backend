import { ConflictException, BadRequestException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto.js';
import type { RegisterData } from '@sahmati/contracts';
export function cleanRegisterData(dto: RegisterDto): RegisterData {
  const result = {
    name: dto.name.trim(),
    purposeEn: dto.purposeEn.trim(),
    purposeHi: dto.purposeHi.trim(),
    dataCategories: dto.dataCategories.map((v) => v.trim()),
    storageLocation: dto.storageLocation.trim(),
    retentionNote: dto.retentionNote.trim(),
    contact: dto.contact.trim(),
  };
  if (Object.values(result).some((v) => (typeof v === 'string' ? !v : v.some((item) => !item))))
    throw new ConflictException('Enter meaningful register values.');
  const references: Pick<
    RegisterData,
    'vendorReferences' | 'storageReferences' | 'hasPaperRecords'
  > = {};
  if (dto.vendorReferences !== undefined) {
    references.vendorReferences = dto.vendorReferences.map((reference) => ({
      name: reference.name.trim(),
      service: reference.service.trim(),
    }));
    assertReferences(
      references.vendorReferences.map((reference) => [reference.name, reference.service]),
    );
  }
  if (dto.storageReferences !== undefined) {
    references.storageReferences = dto.storageReferences.map((reference) => ({
      name: reference.name.trim(),
      medium: reference.medium,
      location: reference.location.trim(),
    }));
    assertReferences(
      references.storageReferences.map((reference) => [
        reference.name,
        reference.medium,
        reference.location,
      ]),
    );
  }
  if (dto.hasPaperRecords !== undefined) references.hasPaperRecords = dto.hasPaperRecords;
  if (
    dto.hasPaperRecords === false &&
    references.storageReferences?.some((reference) => reference.medium === 'paper')
  )
    throw new BadRequestException(
      'Paper storage references conflict with the paper records choice.',
    );
  return { ...result, ...references };
}

function assertReferences(rows: string[][]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.some((value) => !value))
      throw new BadRequestException('Reference labels and details cannot be blank.');
    const key = JSON.stringify(
      row.map((value) => value.normalize('NFKC').replace(/\s+/gu, ' ').toLocaleLowerCase('en')),
    );
    if (seen.has(key)) throw new BadRequestException('Remove duplicate references before saving.');
    seen.add(key);
  }
}
