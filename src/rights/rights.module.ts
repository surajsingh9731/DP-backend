import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RightsRequestEntity } from "./entities/rights-request.entity";
import { RightsService } from "./services/rights.service";
import { PublicRightsController } from "./controllers/public-rights.controller";
import { RightsController } from "./controllers/rights.controller";
import { ParticipantsModule } from "../participants/participants.module";
import { MessagingModule } from "../messaging/messaging.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([RightsRequestEntity]),
    ParticipantsModule,
    MessagingModule,
  ],
  controllers: [PublicRightsController, RightsController],
  providers: [RightsService],
  exports: [RightsService],
})
export class RightsModule {}
