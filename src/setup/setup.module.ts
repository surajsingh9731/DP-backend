import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SetupRecordEntity } from './entities/setup-record.entity';
import { SetupService } from './services/setup.service';
import { SetupController } from './controllers/setup.controller';
import { RegisterModule } from '../register/register.module';

@Module({
  imports: [TypeOrmModule.forFeature([SetupRecordEntity]), RegisterModule],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
