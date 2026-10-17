import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";
import type { EntityManager, EntityTarget, Repository } from "typeorm";

export interface TenantContextState {
  manager: EntityManager;
  tenantId: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * The seam that makes PostgreSQL row-level security the real tenant
 * boundary: every repository access during a request must run on the same
 * transaction-scoped connection that TenantContextInterceptor ran
 * `SET LOCAL app.tenant_id` on — never the shared pool's default manager.
 * Services call `tenantContext.repo(Entity)` instead of `@InjectRepository`.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContextState>();

  run<T>(state: TenantContextState, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(state, fn);
  }

  private get state(): TenantContextState {
    const state = this.storage.getStore();
    if (!state) {
      throw new Error(
        "No tenant context is active. Every repository access must happen inside a request handled by TenantContextInterceptor.",
      );
    }
    return state;
  }

  get manager(): EntityManager {
    return this.state.manager;
  }

  get tenantId(): string | null {
    return this.state.tenantId;
  }

  repo<T extends object>(entity: EntityTarget<T>): Repository<T> {
    return this.manager.getRepository(entity);
  }

  /**
   * For a pre-session request (signup, login) that discovers its tenant
   * mid-handler, after TenantContextInterceptor already opened the
   * transaction with no tenant set. Re-points `app.tenant_id` to the real
   * tenant for the rest of this same transaction, so every insert made
   * from here on (branch, membership, challenge) is both WITH-CHECK- and
   * RETURNING-visible under the strict `tenant_isolation` policy. See
   * enable-rls.ts for why an "insert is always open" carve-out doesn't
   * work for this instead.
   */
  async setTenantId(tenantId: string): Promise<void> {
    if (!UUID_RE.test(tenantId)) {
      throw new Error(
        "setTenantId requires a UUID — refusing to interpolate it into SET LOCAL.",
      );
    }
    await this.manager.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
    this.state.tenantId = tenantId;
  }
}
