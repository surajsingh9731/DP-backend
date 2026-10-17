import { Module } from "@nestjs/common";
import { EvidenceService } from "./services/evidence.service";
import { EvidenceController } from "./controllers/evidence.controller";

@Module({
  controllers: [EvidenceController],
  providers: [EvidenceService],
})
export class EvidenceModule {}
