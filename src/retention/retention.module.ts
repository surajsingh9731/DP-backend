import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RetentionHoldEntity } from "./entities/retention-hold.entity";
import { RetentionActionEntity } from "./entities/retention-action.entity";
import { RetentionService } from "./services/retention.service";
import { RetentionController } from "./controllers/retention.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([RetentionHoldEntity, RetentionActionEntity]),
  ],
  controllers: [RetentionController],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
