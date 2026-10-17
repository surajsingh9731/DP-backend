import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RegisterEntryEntity } from "./entities/register-entry.entity";
import { RegisterRevisionEntity } from "./entities/register-revision.entity";
import { RegisterService } from "./services/register.service";
import { RegisterController } from "./controllers/register.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([RegisterEntryEntity, RegisterRevisionEntity]),
  ],
  controllers: [RegisterController],
  providers: [RegisterService],
  exports: [RegisterService],
})
export class RegisterModule {}
