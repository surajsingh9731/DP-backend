import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { WorkerModule } from "./worker.module";
import { WorkerRunnerService } from "./services/worker-runner.service";
import { AppConfig } from "../config/app-config.service";

/**
 * Entry point for `npm run worker` — a separate process from the API
 * (src/main.ts), polling the shared outbox table. Stopping this process
 * only pauses delivery; nothing else in the app depends on it running.
 */
async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(WorkerModule);
  const config = context.get(AppConfig);
  const runner = context.get(WorkerRunnerService);
  const logger = new Logger("Worker");

  logger.log(`Delivery worker started, polling every ${config.workerPollMs}ms`);

  let stopping = false;
  const loop = async (): Promise<void> => {
    if (stopping) return;
    try {
      const delivered = await runner.tick();
      if (delivered > 0) logger.log(`Delivered ${delivered} message(s)`);
    } catch (error) {
      logger.error(`Worker tick failed: ${String(error)}`);
    }
    setTimeout(() => void loop(), config.workerPollMs);
  };

  process.on("SIGTERM", () => {
    stopping = true;
    logger.log("Worker shutting down");
    void context.close().then(() => process.exit(0));
  });

  void loop();
}

void bootstrap();
