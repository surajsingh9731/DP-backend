import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceRepository } from './workspace.repository.js';
import { WorkspaceService } from './workspace.service.js';
@Module({
  imports: [AuthModule],
  providers: [WorkspaceService, WorkspaceRepository],
  controllers: [WorkspaceController],
})
export class WorkspaceModule {}
