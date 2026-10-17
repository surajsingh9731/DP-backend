import { CheckReviewEvidenceSource } from './check-review-evidence.source.js';
import { CheckEvaluationEvidenceSource } from './check-evaluation-evidence.source.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FollowupsModule } from '../followups/followups.module.js';
import { ChecksController } from './checks.controller.js';
import { ChecksService } from './checks.service.js';
import { ChecksRepository } from './checks.repository.js';
import { LocalChecksService } from './local-checks.service.js';
import { LocationReviewService } from './location-review.service.js';
@Module({
  exports: [CheckReviewEvidenceSource, CheckEvaluationEvidenceSource],
  imports: [AuthModule, FollowupsModule],
  controllers: [ChecksController],
  providers: [
    CheckReviewEvidenceSource,
    CheckEvaluationEvidenceSource,
    ChecksService,
    ChecksRepository,
    LocalChecksService,
    LocationReviewService,
  ],
})
export class ChecksModule {}
