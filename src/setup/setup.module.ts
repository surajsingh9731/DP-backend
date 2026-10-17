import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SetupController } from './setup.controller.js';
import { SetupService } from './setup.service.js';
import { SetupRepository } from './setup.repository.js';
@Module({
  imports: [AuthModule],
  providers: [SetupService, SetupRepository],
  controllers: [SetupController],
})
export class SetupModule {}
