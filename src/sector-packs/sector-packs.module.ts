import { Module } from "@nestjs/common";
import { SectorPackRegistryService } from "./services/sector-pack-registry.service";
import { SectorPacksController } from "./controllers/sector-packs.controller";

@Module({
  controllers: [SectorPacksController],
  providers: [SectorPackRegistryService],
  exports: [SectorPackRegistryService],
})
export class SectorPacksModule {}
