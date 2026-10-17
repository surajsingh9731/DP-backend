import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module";
import { DatabaseModule } from "../database/database.module";
import { MessagesModule } from "../messages/messages.module";
import { LocalModule } from "../local/local.module";
import { WorkerRunnerService } from "./services/worker-runner.service";

/**
 * Deliberately minimal: the worker needs the database, the mail sink, and
 * nothing else — not auth, not any feature module's business logic. It
 * only ever reads/writes message_outbox rows.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule, MessagesModule, LocalModule],
  providers: [WorkerRunnerService],
})
export class WorkerModule {}
