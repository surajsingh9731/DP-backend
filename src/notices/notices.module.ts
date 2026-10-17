import { NoticeEvidenceSource } from './notice-evidence.source.js';
import { NoticeDecisionEvidenceSource } from './notice-decision-evidence.source.js';
import { PreparationModule } from '../preparation/preparation.module.js';
import { NoticeExportService } from './notice-export.service.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NoticesController } from './notices.controller.js';
import { NoticesService } from './notices.service.js';
import { NoticesRepository } from './notices.repository.js';
@Module({
  exports: [NoticeEvidenceSource, NoticeDecisionEvidenceSource],
  imports: [AuthModule, PreparationModule],
  providers: [
    NoticeEvidenceSource,
    NoticeDecisionEvidenceSource,
    NoticesService,
    NoticesRepository,
    NoticeExportService,
  ],
  controllers: [NoticesController],
})
export class NoticesModule {}
