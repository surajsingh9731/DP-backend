import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { EntityManager } from "typeorm";
import { EvidenceLedgerEntryEntity } from "../entities/evidence-ledger-entry.entity";

export interface EvidenceAppendInput {
  tenantId: string;
  kind: string;
  sourceId: string;
  action: string;
  status: string;
  actorId?: string | null;
  provenance: "recorded" | "declared" | "system_verified";
}

/**
 * Append-only, per-tenant hash-chained evidence trail. "Append-only" is a
 * database privilege fact (no UPDATE/DELETE grant on this table — see the
 * Evidence migration), not just this service's own discipline; a
 * correction is always a new row referencing the original by sourceId.
 */
@Injectable()
export class EvidenceLedgerService {
  async append(
    manager: EntityManager,
    input: EvidenceAppendInput,
  ): Promise<EvidenceLedgerEntryEntity> {
    const repo = manager.getRepository(EvidenceLedgerEntryEntity);
    const previous = await repo.findOne({
      where: { tenantId: input.tenantId },
      order: { createdAt: "DESC" },
    });
    const previousHash = previous?.eventHash ?? null;
    const occurredAt = new Date();
    const eventHash = createHash("sha256")
      .update(
        JSON.stringify({
          tenantId: input.tenantId,
          kind: input.kind,
          sourceId: input.sourceId,
          action: input.action,
          status: input.status,
          previousHash,
          occurredAt: occurredAt.toISOString(),
        }),
      )
      .digest("hex");

    return repo.save(
      repo.create({
        tenantId: input.tenantId,
        kind: input.kind,
        sourceId: input.sourceId,
        action: input.action,
        status: input.status,
        actorId: input.actorId ?? null,
        provenance: input.provenance,
        previousHash,
        eventHash,
        occurredAt,
      }),
    );
  }
}
