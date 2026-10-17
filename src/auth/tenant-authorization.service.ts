import { AuthRepository } from './auth.repository.js';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';

@Injectable()
export class TenantAuthorizationService {
  constructor(private readonly repository: AuthRepository) {}
  /** Revalidate and lock the current membership on the caller's tenant transaction. */
  async assertCurrent(client: DatabaseClient, scope: TenantScope): Promise<void> {
    const membership = await this.repository.lockedMembership(client, scope);
    if (membership?.role !== scope.role || membership.branch_id !== scope.branchId)
      throw new ForbiddenException('Workspace access changed.');
  }
}
