import "reflect-metadata";
import { DataSource, type DataSourceOptions } from "typeorm";
import { config as loadEnv } from "dotenv";
import { SnakeCaseNamingStrategy } from "./snake-case.naming-strategy";

loadEnv();

/**
 * Single source of truth for the database connection. Used by the running
 * app (via TypeOrmModule.forRootAsync, see database.module.ts) and by the
 * TypeORM CLI for migrations (`npm run db:migrate`), so both always see the
 * exact same entities/migrations list.
 *
 * synchronize is intentionally false, always: schema changes only ever
 * happen through an explicit, checksummed, ordered migration.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? "postgres",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_DATABASE ?? "sahmati_local",
  entities: [__dirname + "/../**/*.entity{.ts,.js}"],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  migrationsTableName: "schema_migrations",
  namingStrategy: new SnakeCaseNamingStrategy(),
  synchronize: false,
  dropSchema: false,
  logging: process.env.DB_LOGGING === "true",
};

export const AppDataSource = new DataSource(dataSourceOptions);
