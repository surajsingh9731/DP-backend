import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TrainingProgressEntity } from "./entities/training-progress.entity";
import { TrainingService } from "./services/training.service";
import { TrainingController } from "./controllers/training.controller";

@Module({
  imports: [TypeOrmModule.forFeature([TrainingProgressEntity])],
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
