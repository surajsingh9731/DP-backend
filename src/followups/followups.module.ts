import { FollowupEvidenceSource } from './followup-evidence.source.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FollowupsController } from './followups.controller.js';
import { FollowupsService } from './followups.service.js';
import { FollowupsRepository } from './followups.repository.js';
import { FollowupCreationService } from './followup-creation.service.js';
import { FollowupHistoryService } from './followup-history.service.js';
@Module({
  imports: [AuthModule],
  controllers: [FollowupsController],
  providers: [
    FollowupEvidenceSource,
    FollowupsService,
    FollowupsRepository,
    FollowupCreationService,
    FollowupHistoryService,
  ],
  exports: [
    FollowupEvidenceSource,
    FollowupCreationService,
    FollowupsRepository,
    FollowupHistoryService,
  ],
})
export class FollowupsModule {}
