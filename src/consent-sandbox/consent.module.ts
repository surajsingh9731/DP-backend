import { ConsentEvidenceSource } from './consent-evidence.source.js';
import { WithdrawalEvidenceSource } from './withdrawal-evidence.source.js';
import { FollowupsModule } from '../followups/followups.module.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PreparationModule } from '../preparation/preparation.module.js';
import { ConsentController } from './consent.controller.js';
import { ConsentRepository } from './consent.repository.js';
import { ConsentSourceService } from './consent-source.service.js';
import { ConsentOffersService } from './consent-offers.service.js';
import { ConsentParticipantsService } from './consent-participants.service.js';
import { ConsentChoicesService } from './consent-choices.service.js';
@Module({
  imports: [AuthModule, PreparationModule, FollowupsModule],
  controllers: [ConsentController],
  exports: [ConsentEvidenceSource, WithdrawalEvidenceSource, ConsentParticipantsService],
  providers: [
    ConsentEvidenceSource,
    WithdrawalEvidenceSource,
    ConsentRepository,
    ConsentSourceService,
    ConsentOffersService,
    ConsentParticipantsService,
    ConsentChoicesService,
  ],
})
export class ConsentModule {}
