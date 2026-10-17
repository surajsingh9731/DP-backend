import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MailEntity } from "./entities/mail.entity";
import { MailboxService } from "./services/mailbox.service";
import { MailboxController } from "./controllers/mailbox.controller";

@Module({
  imports: [TypeOrmModule.forFeature([MailEntity])],
  controllers: [MailboxController],
  providers: [MailboxService],
  exports: [MailboxService],
})
export class LocalModule {}
