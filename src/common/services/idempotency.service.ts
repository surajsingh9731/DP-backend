import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { IdempotencyKeyEntity } from "../entities/idempotency-key.entity";

/**
 * Makes a mutation safe to retry. Every state-changing endpoint in this
 * backend takes a client-generated `idempotencyKey` in its request body
 * (the frontend derives it from the action + payload — see
 * `storedActionKey` on the frontend). Wrapping the mutation in `runOnce`
 * means a dropped connection and blind retry replays the SAME stored
 * result instead of performing the action twice.
 *
 * Always called with the same EntityManager the caller's mutation runs
 * under, so the idempotency record commits atomically with the write it
 * is guarding.
 */
@Injectable()
export class IdempotencyService {
  async runOnce<T>(
    manager: EntityManager,
    tenantId: string,
    key: string,
    handler: () => Promise<T>,
  ): Promise<T> {
    const existing = await manager.findOne(IdempotencyKeyEntity, {
      where: { tenantId, key },
    });
    if (existing) return existing.responseBody as T;

    const result = await handler();
    const record = manager.create(IdempotencyKeyEntity, {
      tenantId,
      key,
      responseStatus: 200,
      responseBody: result as unknown,
    });
    await manager.save(record);
    return result;
  }
}
