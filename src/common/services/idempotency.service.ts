import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { IdempotencyKeyEntity } from "../entities/idempotency-key.entity";

/**
 * Runs `handler` at most once per (tenantId, key). A client that retries a
 * mutating request after a dropped response (common on 3G) gets back the
 * original result instead of creating a duplicate record.
 */
@Injectable()
export class IdempotencyService {
  async runOnce<T>(
    manager: EntityManager,
    tenantId: string,
    key: string,
    handler: () => Promise<T>,
  ): Promise<T> {
    const repo = manager.getRepository(IdempotencyKeyEntity);
    const existing = await repo.findOne({ where: { tenantId, key } });
    if (existing) return existing.response as T;

    const result = await handler();
    await repo.save(
      repo.create({ tenantId, key, response: result as unknown }),
    );
    return result;
  }
}
