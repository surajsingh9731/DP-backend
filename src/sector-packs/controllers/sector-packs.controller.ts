import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { SectorPackRegistryService } from "../services/sector-pack-registry.service";

export interface SectorPackSummary {
  code: string;
  label: { en: string; hi: string };
}

/** Public (pre-signup) listing so the signup wizard can populate "what do you run?" from real pack data, never a hardcoded list. */
@Controller("sector-packs")
export class SectorPacksController {
  constructor(private readonly registry: SectorPackRegistryService) {}

  @Public()
  @Get()
  list(): SectorPackSummary[] {
    return this.registry
      .list()
      .map((pack) => ({ code: pack.code, label: pack.label }));
  }
}
