import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "../app.module";
import { WorkerRunnerService } from "../messaging/services/worker-runner.service";
import { RetentionSchedulerService } from "../retention/services/retention-scheduler.service";

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);
const RETENTION_SWEEP_INTERVAL_MS = Number(
  process.env.RETENTION_SWEEP_INTERVAL_MS ?? 60 * 60 * 1000,
);

/**
 * The standalone worker process (brief: "independent restart/scale from
 * the API process"). Reuses the same AppModule the HTTP server bootstraps
 * — same DataSource, same RLS-respecting connection pattern — but never
 * calls `.listen()`, so this process never accepts HTTP traffic. Two
 * independent poll loops: message_outbox delivery (frequent) and the
 * retention scheduler (hourly by default — overdue data doesn't need
 * second-by-second polling the way a queued message does).
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger("Worker");
  const app = await NestFactory.createApplicationContext(AppModule);
  const messageRunner = app.get(WorkerRunnerService);
  const retentionScheduler = app.get(RetentionSchedulerService);

  let stopping = false;

  const deliverMessages = async (): Promise<void> => {
    if (stopping) return;
    try {
      const { processed } = await messageRunner.runOnce();
      if (processed > 0)
        logger.log(`Delivered ${processed} queued message(s).`);
    } catch (error) {
      logger.error(
        `Message delivery tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const sweepRetention = async (): Promise<void> => {
    if (stopping) return;
    try {
      const { alerted } = await retentionScheduler.runSweep();
      if (alerted > 0) logger.log(`Raised ${alerted} new retention alert(s).`);
    } catch (error) {
      logger.error(
        `Retention sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const messageInterval = setInterval(
    () => void deliverMessages(),
    POLL_INTERVAL_MS,
  );
  const retentionInterval = setInterval(
    () => void sweepRetention(),
    RETENTION_SWEEP_INTERVAL_MS,
  );
  void deliverMessages();
  void sweepRetention();

  const shutdown = async (): Promise<void> => {
    stopping = true;
    clearInterval(messageInterval);
    clearInterval(retentionInterval);
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  logger.log(
    `Worker started — delivering messages every ${POLL_INTERVAL_MS}ms, sweeping retention every ${RETENTION_SWEEP_INTERVAL_MS}ms.`,
  );
}

void bootstrap();
