import { RetentionModule } from './retention/retention.module.js';
import { EvidenceModule } from './evidence/evidence.module.js';
import { RightsModule } from './rights/rights.module.js';
import { ChecksModule } from './checks/checks.module.js';
import { ConsentModule } from './consent-sandbox/consent.module.js';
import { PreparationModule } from './preparation/preparation.module.js';
import { NoticesModule } from './notices/notices.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadConfig } from './config/runtime.config.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { LocalModule } from './local/local.module.js';
import { RegisterModule } from './register/register.module.js';
import { SetupModule } from './setup/setup.module.js';
import { WorkspaceModule } from './workspace/workspace.module.js';
@Module({
  imports: [
    RetentionModule,
    EvidenceModule,
    RightsModule,
    ChecksModule,
    ConsentModule,
    NoticesModule,
    PreparationModule,
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [loadConfig] }),
    DatabaseModule,
    AuthModule,
    WorkspaceModule,
    RegisterModule,
    SetupModule,
    LocalModule,
  ],
})
export class AppModule {}
