import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { databaseClient, type DatabaseClient, type DatabaseResult } from './database-client.js';
@Injectable()
export class Database {
  constructor(@InjectDataSource() readonly dataSource: DataSource) {}

  // Unscoped operational/test queries still use an explicit transaction-local empty context.
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<DatabaseResult<T>> {
    return this.transaction(null, (client) => client.query<T>(sql, params));
  }

  async transaction<T>(
    tenantId: string | null,
    action: (client: DatabaseClient) => Promise<T>,
    isolation?: 'REPEATABLE READ',
  ): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction(isolation);
      // Always set an explicit transaction-local value, including the unscoped case.
      await runner.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId ?? '']);
      const result = await action(databaseClient(runner));
      await runner.commitTransaction();
      return result;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
