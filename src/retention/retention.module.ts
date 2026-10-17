import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RetentionController } from './retention.controller.js';
import { RetentionRepository } from './retention.repository.js';
import { RetentionHistoryService } from './retention-history.service.js';
import { RetentionInputsService } from './retention-inputs.service.js';
import { RetentionRecordsService } from './retention-records.service.js';
import { RetentionPoliciesService } from './retention-policies.service.js';
import { RetentionHoldsService } from './retention-holds.service.js';
import { RetentionPreviewsService } from './retention-previews.service.js';
@Module({
  imports: [AuthModule],
  controllers: [RetentionController],
  providers: [
    RetentionRepository,
    RetentionHistoryService,
    RetentionInputsService,
    RetentionRecordsService,
    RetentionPoliciesService,
    RetentionHoldsService,
    RetentionPreviewsService,
  ],
})
export class RetentionModule {}
