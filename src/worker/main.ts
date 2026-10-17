import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WorkerModule, DeliveryWorker } from './worker.js';
async function main(): Promise<void> {
  process.env['SAHMATI_PROCESS_KIND'] = 'worker';
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const worker = app.get(DeliveryWorker);
  const poll = app.get(ConfigService).getOrThrow<number>('pollMs');
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const logger = new Logger('Worker');
  logger.log('Local delivery worker ready.');
  while (!stopping) {
    try {
      await worker.tick();
    } catch {
      logger.error({ event: 'worker_tick_failed' });
    }
    await new Promise((resolve) => setTimeout(resolve, poll));
  }
  await app.close();
}
void main().catch(() => {
  new Logger('Worker').error('Local worker startup failed.');
  process.exitCode = 1;
});
