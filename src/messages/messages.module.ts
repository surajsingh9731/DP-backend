import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MessageOutboxEntity } from "./entities/message-outbox.entity";
import { MessagesService } from "./services/messages.service";

@Module({
  imports: [TypeOrmModule.forFeature([MessageOutboxEntity])],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
