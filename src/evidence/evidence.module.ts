import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NoticesModule } from '../notices/notices.module.js';
import { ConsentModule } from '../consent-sandbox/consent.module.js';
import { FollowupsModule } from '../followups/followups.module.js';
import { ChecksModule } from '../checks/checks.module.js';
import { RightsModule } from '../rights/rights.module.js';
import { EvidenceController } from './evidence.controller.js';
import { EvidenceService } from './evidence.service.js';
import { EvidenceSources } from './evidence-sources.service.js';
@Module({
  imports: [AuthModule, NoticesModule, ConsentModule, FollowupsModule, ChecksModule, RightsModule],
  controllers: [EvidenceController],
  providers: [EvidenceService, EvidenceSources],
})
export class EvidenceModule {}
