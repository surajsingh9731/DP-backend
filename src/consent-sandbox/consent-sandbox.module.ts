import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConsentOfferEntity } from "./entities/consent-offer.entity";
import { ConsentParticipantEntity } from "./entities/consent-participant.entity";
import { ConsentReceiptEntity } from "./entities/consent-receipt.entity";
import { ConsentSandboxService } from "./services/consent-sandbox.service";
import { ConsentSandboxController } from "./controllers/consent-sandbox.controller";
import { NoticesModule } from "../notices/notices.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConsentOfferEntity,
      ConsentParticipantEntity,
      ConsentReceiptEntity,
    ]),
    NoticesModule,
  ],
  controllers: [ConsentSandboxController],
  providers: [ConsentSandboxService],
  exports: [ConsentSandboxService],
})
export class ConsentSandboxModule {}
