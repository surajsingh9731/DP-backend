import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DATABASE_ENTITIES } from './entities/index.js';
import { DATABASE_POLICY } from '../constants/database.constants.js';
export function typeormConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: config.getOrThrow<string>(
      process.env['SAHMATI_PROCESS_KIND'] === 'worker' ? 'workerUrl' : 'appUrl',
    ),
    entities: DATABASE_ENTITIES,
    synchronize: false,
    dropSchema: false,
    migrationsRun: false,
    logging: false,
    extra: {
      max: DATABASE_POLICY.poolSize,
      idleTimeoutMillis: DATABASE_POLICY.idleTimeoutMs,
      connectionTimeoutMillis: DATABASE_POLICY.connectionTimeoutMs,
      statement_timeout: DATABASE_POLICY.statementTimeoutMs,
    },
  };
}
