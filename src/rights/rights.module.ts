import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RightsRequestEntity } from "./entities/rights-request.entity";
import { RightsWorkItemEntity } from "./entities/rights-work-item.entity";
import { RightsResponseEntity } from "./entities/rights-response.entity";
import { RightsAuditEventEntity } from "./entities/rights-audit-event.entity";
import { RightsService } from "./services/rights.service";
import { RightsParticipantController } from "./controllers/rights-participant.controller";
import { RightsAdminController } from "./controllers/rights-admin.controller";
import { ConsentSandboxModule } from "../consent-sandbox/consent-sandbox.module";
import { NoticesModule } from "../notices/notices.module";
import { RegisterModule } from "../register/register.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RightsRequestEntity,
      RightsWorkItemEntity,
      RightsResponseEntity,
      RightsAuditEventEntity,
    ]),
    ConsentSandboxModule,
    NoticesModule,
    RegisterModule,
    AuthModule,
  ],
  controllers: [RightsParticipantController, RightsAdminController],
  providers: [RightsService],
})
export class RightsModule {}
