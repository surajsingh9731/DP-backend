import { Controller, Get } from "@nestjs/common";
import type { MessageOutboxView } from "@sahmati/contracts";
import { MessageOutboxService } from "../services/message-outbox.service";

@Controller("messages")
export class MessagingController {
  constructor(private readonly outbox: MessageOutboxService) {}

  @Get("outbox")
  list(): Promise<MessageOutboxView[]> {
    return this.outbox.list();
  }
}
