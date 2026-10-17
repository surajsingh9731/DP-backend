import { ForbiddenException, ConflictException } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
export function retentionEditor(scope: TenantScope) {
  if (scope.role === 'viewer')
    throw new ForbiddenException('Retention workbench needs owner or staff access.');
}
export function retentionOwner(scope: TenantScope) {
  if (scope.role !== 'owner')
    throw new ForbiddenException(
      'Only owners can review policy, manage holds or read dry-run inputs.',
    );
}
export function retentionVersion(actual: number, expected: number) {
  if (actual !== expected)
    throw new ConflictException('Source version changed. Refresh before recording a decision.');
}
