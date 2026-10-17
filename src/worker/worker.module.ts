import { WorkerRepository } from './worker.repository.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadConfig } from '../config/runtime.config.js';
import { DatabaseModule } from '../database/database.module.js';
import { DeliveryWorker } from './worker.service.js';
import { DatabaseSink, MESSAGE_CHANNEL } from './channel.js';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [loadConfig] }),
    DatabaseModule,
  ],
  providers: [
    WorkerRepository,
    DeliveryWorker,
    { provide: MESSAGE_CHANNEL, useClass: DatabaseSink },
  ],
})
export class WorkerModule {}
