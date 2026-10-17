import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WorkspaceTaskEntity } from "./entities/workspace-task.entity";
import { WorkspaceTaskEventEntity } from "./entities/workspace-task-event.entity";
import { WorkspaceService } from "./services/workspace.service";
import { WorkspaceController } from "./controllers/workspace.controller";
import { AuthModule } from "../auth/auth.module";
import { MessagesModule } from "../messages/messages.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceTaskEntity, WorkspaceTaskEventEntity]),
    AuthModule,
    MessagesModule,
  ],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
})
export class WorkspaceModule {}
