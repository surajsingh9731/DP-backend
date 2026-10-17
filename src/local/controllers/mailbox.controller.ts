import { Controller, Get } from "@nestjs/common";
import type { MailView } from "@sahmati/contracts";
import { Public } from "../../common/decorators/public.decorator";
import { MailboxService } from "../services/mailbox.service";

/**
 * Local-only mailbox so a developer/reviewer can see what would have been
 * emailed, without any real mail provider configured. Never expose this
 * route outside a local/dev environment.
 */
@Controller("dev/mail")
export class MailboxController {
  constructor(private readonly mailbox: MailboxService) {}

  @Public()
  @Get()
  list(): Promise<MailView[]> {
    return this.mailbox.list();
  }
}
