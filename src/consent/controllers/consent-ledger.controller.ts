import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import type { ConsentLedgerItemView } from "@sahmati/contracts";
import { ConsentService } from "../services/consent.service";
import { Roles } from "../../common/decorators/roles.decorator";

@Controller("consent")
export class ConsentLedgerController {
  constructor(private readonly consent: ConsentService) {}

  @Get("ledger")
  ledger(@Query("kind") kind?: string): Promise<ConsentLedgerItemView[]> {
    return this.consent.ledger(kind);
  }

  @Get("followups")
  followups() {
    return this.consent.openFollowups();
  }

  @Roles("owner", "staff")
  @Post("followups/:id/close")
  close(@Param("id") id: string): Promise<void> {
    return this.consent.closeFollowup(id);
  }
}
