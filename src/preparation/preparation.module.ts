import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PreparationController } from './preparation.controller.js';
import { PreparationService } from './preparation.service.js';
import { PreparationRepository } from './preparation.repository.js';
import { PreparationSelectionService } from './preparation-selection.service.js';
@Module({
  imports: [AuthModule],
  controllers: [PreparationController],
  providers: [PreparationService, PreparationRepository, PreparationSelectionService],
  exports: [PreparationSelectionService],
})
export class PreparationModule {}
