import { Global, Module } from "@nestjs/common";
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  Reflector,
} from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SessionEntity } from "../auth/entities/session.entity";
import { SessionGuard } from "./guards/session.guard";
import { RolesGuard } from "./guards/roles.guard";
import { TenantContextInterceptor } from "./interceptors/tenant-context.interceptor";
import { TenantContextService } from "./services/tenant-context.service";
import { HttpExceptionFilter } from "./filters/http-exception.filter";
import { EvidenceLedgerService } from "./services/evidence-ledger.service";
import { IdempotencyService } from "./services/idempotency.service";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SessionEntity])],
  providers: [
    Reflector,
    TenantContextService,
    EvidenceLedgerService,
    IdempotencyService,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
  exports: [TenantContextService, EvidenceLedgerService, IdempotencyService],
})
export class CommonModule {}
