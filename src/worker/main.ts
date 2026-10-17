import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "../app.module";
import { WorkerRunnerService } from "../messaging/services/worker-runner.service";

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);

/**
 * The standalone worker process module ownership (brief: "independent
 * restart/scale from the API process"). Reuses the same AppModule the HTTP
 * server bootstraps — same DataSource, same RLS-respecting connection
 * pattern — but never calls `.listen()`, so this process never accepts
 * HTTP traffic. Its only job is to poll message_outbox and deliver.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger("Worker");
  const app = await NestFactory.createApplicationContext(AppModule);
  const runner = app.get(WorkerRunnerService);

  let stopping = false;
  const tick = async (): Promise<void> => {
    if (stopping) return;
    try {
      const { processed } = await runner.runOnce();
      if (processed > 0)
        logger.log(`Delivered ${processed} queued message(s).`);
    } catch (error) {
      logger.error(
        `Worker tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);
  void tick();

  const shutdown = async (): Promise<void> => {
    stopping = true;
    clearInterval(interval);
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  logger.log(`Worker started, polling every ${POLL_INTERVAL_MS}ms.`);
}

void bootstrap();
