import { RightsEvidenceSource } from './rights-evidence.source.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ConsentModule } from '../consent-sandbox/consent.module.js';
import { FollowupsModule } from '../followups/followups.module.js';
import { ParticipantRightsController } from './participant-rights.controller.js';
import { RightsTriageController } from './rights-triage.controller.js';
import { ParticipantRightsService } from './participant-rights.service.js';
import { RightsTriageService } from './rights-triage.service.js';
import { RightsRepository } from './rights.repository.js';
import { RightsHistoryService } from './rights-history.service.js';
import { RightsSourceService } from './rights-source.service.js';
@Module({
  exports: [RightsEvidenceSource],
  imports: [AuthModule, ConsentModule, FollowupsModule],
  controllers: [ParticipantRightsController, RightsTriageController],
  providers: [
    RightsEvidenceSource,
    ParticipantRightsService,
    RightsTriageService,
    RightsRepository,
    RightsHistoryService,
    RightsSourceService,
  ],
})
export class RightsModule {}
