import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppConfigModule } from "../config/app-config.module";
import { AppConfigService } from "../config/app-config.service";
import { SnakeCaseNamingStrategy } from "./snake-case.naming-strategy";
import { ALL_ENTITIES } from "./entities";

/**
 * Runtime connection pool used by every request-serving service. Connects
 * as the restricted `sahmati_app` role (NOBYPASSRLS, no DDL rights, no
 * table ownership) — this is what makes row-level security the real
 * tenant-isolation boundary rather than a policy nobody's connection
 * actually respects. Migrations run separately as the privileged
 * DB_ADMIN_* role (see data-source.ts) and are never run through this pool.
 */
@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        type: "postgres" as const,
        ...config.db,
        namingStrategy: new SnakeCaseNamingStrategy(),
        entities: ALL_ENTITIES,
        synchronize: false,
        logging: !config.isProduction,
      }),
    }),
  ],
})
export class DatabaseModule {}
