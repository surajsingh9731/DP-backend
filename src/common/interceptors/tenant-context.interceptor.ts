import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import type { Request } from "express";
import { Observable, from, lastValueFrom } from "rxjs";
import { TenantContextService } from "../services/tenant-context.service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Opens one transaction per request on a dedicated QueryRunner (never the
 * shared pool), sets `app.tenant_id` for that transaction from the
 * authenticated session (SessionGuard runs first and attaches it), and
 * makes that transaction's EntityManager the only one TenantContextService
 * exposes for the rest of the request. Commits on success. On a thrown
 * error, an expected business outcome (an HttpException with a 4xx
 * status — "wrong code", "not found", "forbidden") still commits:
 * whatever the handler wrote before throwing (e.g. an OTP attempt
 * counter increment) is real work that should persist alongside the
 * error response, not be silently undone. Only a 5xx/unexpected error
 * rolls back, since that's the case where the handler's partial work is
 * actually suspect.
 *
 * Requests with no resolved tenant (public signup/login-challenge
 * endpoints) still get a transaction, just with `app.tenant_id` left
 * unset — only tables with a nullable-tenant RLS policy are reachable
 * then, by design.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<
        Request & { tenantId?: string; participantSessionId?: string }
      >();
    return from(this.run(req, next));
  }

  private async run(
    req: Request & { tenantId?: string; participantSessionId?: string },
    next: CallHandler,
  ): Promise<unknown> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const tenantId = req.tenantId ?? null;
      const participantSessionId = req.participantSessionId ?? null;
      for (const [label, value] of [
        ["tenant id", tenantId],
        ["participant session id", participantSessionId],
      ] as const) {
        if (value !== null && !UUID_RE.test(value)) {
          throw new Error(
            `Resolved ${label} is not a UUID — refusing to interpolate it into SET LOCAL.`,
          );
        }
      }
      // Always SET LOCAL explicitly, even to '' — a pooled connection that
      // was ever SET on a previous transaction resets the GUC to an empty
      // string, not a true NULL, so leaving this unset for a no-tenant
      // request would silently inherit stale state. See enable-rls.ts.
      await queryRunner.query(`SET LOCAL app.tenant_id = '${tenantId ?? ""}'`);
      await queryRunner.query(
        `SET LOCAL app.participant_session_id = '${participantSessionId ?? ""}'`,
      );
      const result = await this.tenantContext.run(
        { manager: queryRunner.manager, tenantId },
        () => lastValueFrom(next.handle(), { defaultValue: undefined }),
      );
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      const isExpectedBusinessError =
        error instanceof HttpException && error.getStatus() < 500;
      if (isExpectedBusinessError) {
        await queryRunner.commitTransaction();
      } else {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
