import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Database } from './database.service.js';
import { typeormConfig } from './typeorm.config.js';
@Global()
@Module({
  imports: [TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: typeormConfig })],
  providers: [Database],
  exports: [Database, TypeOrmModule],
})
export class DatabaseModule {}
