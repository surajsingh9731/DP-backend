import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { TenantContextService } from "./tenant-context.service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * The shared "loop over every tenant, one transaction each" pattern behind
 * every background sweep (message outbox delivery, retention alerts, and
 * any future one) that isn't driven by an incoming request. Each tenant
 * gets its own transaction with `app.tenant_id` set — the same
 * RLS-respecting pattern TenantContextInterceptor uses per request — so a
 * sweep never needs a BYPASSRLS role to see across tenants.
 */
@Injectable()
export class TenantSweepService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Sweeps every tenant by default, or — for a caller that already knows
   * which tenants it's entitled to touch (e.g. the partner portal's own
   * cross-tenant membership rows) — just the given `tenantIds`. Passing an
   * explicit list never widens access beyond what the caller already
   * proved it may see; it only narrows which of the normal full sweep's
   * tenants get visited.
   */
  async forEachTenant<T>(
    handler: (tenantId: string) => Promise<T>,
    tenantIds?: string[],
  ): Promise<T[]> {
    const ids =
      tenantIds ??
      (await this.dataSource.query(`SELECT id FROM organisations`)).map(
        (row: { id: string }) => row.id,
      );
    const results: T[] = [];
    for (const tenantId of ids) {
      results.push(await this.runInTenantTransaction(tenantId, handler));
    }
    return results;
  }

  private async runInTenantTransaction<T>(
    tenantId: string,
    handler: (tenantId: string) => Promise<T>,
  ): Promise<T> {
    if (!UUID_RE.test(tenantId)) {
      throw new Error(
        "Organisation id is not a UUID — refusing to interpolate it into SET LOCAL.",
      );
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
      await queryRunner.query(`SET LOCAL app.participant_session_id = ''`);
      await queryRunner.query(`SET LOCAL app.user_id = ''`);
      const result = await this.tenantContext.run(
        { manager: queryRunner.manager, tenantId },
        () => handler(tenantId),
      );
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
