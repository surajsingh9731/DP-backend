import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { APP_GUARD } from "@nestjs/core";
import { EvidenceLedgerEntryEntity } from "./entities/evidence-ledger-entry.entity";
import { IdempotencyKeyEntity } from "./entities/idempotency-key.entity";
import { EvidenceLedgerService } from "./services/evidence-ledger.service";
import { IdempotencyService } from "./services/idempotency.service";
import { SessionGuard } from "./guards/session.guard";
import { AuthModule } from "../auth/auth.module";

/**
 * Cross-cutting providers every feature module shares: the evidence/audit
 * ledger, the idempotency guard-rail, and the global session guard. Global
 * so no feature module needs to remember to import it for the guard to run.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([EvidenceLedgerEntryEntity, IdempotencyKeyEntity]),
    AuthModule,
  ],
  providers: [
    EvidenceLedgerService,
    IdempotencyService,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [TypeOrmModule, EvidenceLedgerService, IdempotencyService],
})
export class CommonModule {}
