import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreparationRecordEntity } from './entities/preparation-record.entity';
import { PreparationHistoryEntity } from './entities/preparation-history.entity';
import { PreparationService } from './services/preparation.service';
import { PreparationController } from './controllers/preparation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PreparationRecordEntity, PreparationHistoryEntity])],
  controllers: [PreparationController],
  providers: [PreparationService],
  exports: [PreparationService],
})
export class PreparationModule {}
