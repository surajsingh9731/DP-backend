import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BreachIncidentEntity } from "./entities/breach-incident.entity";
import { BreachService } from "./services/breach.service";
import { BreachController } from "./controllers/breach.controller";

@Module({
  imports: [TypeOrmModule.forFeature([BreachIncidentEntity])],
  controllers: [BreachController],
  providers: [BreachService],
  exports: [BreachService],
})
export class BreachModule {}
