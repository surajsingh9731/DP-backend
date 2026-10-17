import type { EntityManager, QueryRunner, QueryResult } from 'typeorm';
export interface DatabaseResult<T> {
  rows: T[];
  rowCount: number;
}
export interface DatabaseClient {
  readonly manager: EntityManager;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<DatabaseResult<T>>;
}
export function databaseClient(runner: QueryRunner): DatabaseClient {
  return {
    manager: runner.manager,
    async query<T>(sql: string, params: unknown[] = []): Promise<DatabaseResult<T>> {
      const result = (await runner.query(sql, params, true)) as QueryResult;
      return { rows: result.records as T[], rowCount: result.affected ?? result.records.length };
    },
  };
}
