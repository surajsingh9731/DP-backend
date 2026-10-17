import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckReviewEntity } from "./entities/check-review.entity";
import { CheckEvaluationEntity } from "./entities/check-evaluation.entity";
import { ChecksService } from "./services/checks.service";
import { ChecksController } from "./controllers/checks.controller";
import { FollowupTaskEntity } from "../followups/entities/followup-task.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CheckReviewEntity,
      CheckEvaluationEntity,
      FollowupTaskEntity,
    ]),
  ],
  controllers: [ChecksController],
  providers: [ChecksService],
})
export class ChecksModule {}
