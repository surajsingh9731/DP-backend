import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { LocalModule } from './local/local.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, CommonModule, AuthModule, LocalModule],
})
export class AppModule {}
