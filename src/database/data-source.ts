import { config as loadDotenv } from "dotenv";
import { DataSource } from "typeorm";

loadDotenv();

import { SnakeCaseNamingStrategy } from "./snake-case.naming-strategy";
import { ALL_ENTITIES } from "./entities";

/**
 * Migration-runner data source only. Connects with the privileged
 * DB_ADMIN_* role (schema owner) because creating tables, roles and RLS
 * policies needs DDL rights the restricted runtime role deliberately does
 * not have. Nothing request-serving uses this file — see database.module.ts.
 */
const AdminDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_ADMIN_USERNAME,
  password: process.env.DB_ADMIN_PASSWORD,
  database: process.env.DB_DATABASE,
  namingStrategy: new SnakeCaseNamingStrategy(),
  entities: ALL_ENTITIES,
  migrations: [`${__dirname}/migrations/*.{ts,js}`],
  synchronize: false,
});

export default AdminDataSource;
