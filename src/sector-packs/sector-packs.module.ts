import { Module } from "@nestjs/common";
import { SectorPackRegistryService } from "./services/sector-pack-registry.service";

@Module({
  providers: [SectorPackRegistryService],
  exports: [SectorPackRegistryService],
})
export class SectorPacksModule {}
