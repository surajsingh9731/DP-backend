import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/app-config.module";
import { DatabaseModule } from "./database/database.module";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./auth/auth.module";
import { LocalModule } from "./local/local.module";
import { RegisterModule } from "./register/register.module";
import { SetupModule } from "./setup/setup.module";
import { PreparationModule } from "./preparation/preparation.module";
import { NoticesModule } from "./notices/notices.module";
import { ConsentSandboxModule } from "./consent-sandbox/consent-sandbox.module";
import { FollowupsModule } from "./followups/followups.module";
import { ChecksModule } from "./checks/checks.module";
import { RightsModule } from "./rights/rights.module";
import { WorkspaceModule } from "./workspace/workspace.module";
import { EvidenceModule } from "./evidence/evidence.module";
import { RetentionModule } from "./retention/retention.module";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CommonModule,
    AuthModule,
    LocalModule,
    WorkspaceModule,
    RegisterModule,
    SetupModule,
    PreparationModule,
    NoticesModule,
    ConsentSandboxModule,
    FollowupsModule,
    ChecksModule,
    RightsModule,
    EvidenceModule,
    RetentionModule,
  ],
})
export class AppModule {}
