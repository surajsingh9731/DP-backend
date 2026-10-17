import { Controller, Get } from '@nestjs/common';
import { LocalService } from './local.service.js';
@Controller()
export class LocalController {
  constructor(private readonly service: LocalService) {}
  @Get('health/live') live() {
    return this.service.live();
  }
  @Get('health/ready') ready() {
    return this.service.ready();
  }
  @Get('dev/mail') mailbox() {
    return this.service.mailbox();
  }
}
