import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PublicVerificationSessionEntity } from "./entities/public-verification-session.entity";
import { ParticipantVerificationService } from "./services/participant-verification.service";
import { PublicVerificationController } from "./controllers/public-verification.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { ParticipantSessionGuard } from "../common/guards/participant-session.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([PublicVerificationSessionEntity]),
    NotificationsModule,
  ],
  controllers: [PublicVerificationController],
  providers: [ParticipantVerificationService, ParticipantSessionGuard],
  // Re-exporting TypeOrmModule (not just the guard/service) matters: a
  // consuming module's @UseGuards(ParticipantSessionGuard) resolves the
  // guard's own dependencies (its injected Repository) from the
  // consuming module's visible providers, not just from this module's
  // internal scope — so the forFeature repository token must be visible
  // too, not only the guard class itself.
  exports: [
    ParticipantVerificationService,
    ParticipantSessionGuard,
    TypeOrmModule,
  ],
})
export class ParticipantsModule {}
