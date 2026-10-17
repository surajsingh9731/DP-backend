import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConsentReceiptEntity } from "./entities/consent-receipt.entity";
import { WithdrawalFollowupEntity } from "./entities/withdrawal-followup.entity";
import { ConsentService } from "./services/consent.service";
import { PublicConsentController } from "./controllers/public-consent.controller";
import { ConsentLedgerController } from "./controllers/consent-ledger.controller";
import { NoticesModule } from "../notices/notices.module";
import { ParticipantsModule } from "../participants/participants.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ConsentReceiptEntity, WithdrawalFollowupEntity]),
    NoticesModule,
    ParticipantsModule,
  ],
  controllers: [PublicConsentController, ConsentLedgerController],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
