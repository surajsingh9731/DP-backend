import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NoticeSnapshotEntity } from './entities/notice-snapshot.entity';
import { NoticesService } from './services/notices.service';
import { NoticePdfService } from './services/notice-pdf.service';
import { NoticesController } from './controllers/notices.controller';
import { RegisterModule } from '../register/register.module';
import { PreparationModule } from '../preparation/preparation.module';

@Module({
  imports: [TypeOrmModule.forFeature([NoticeSnapshotEntity]), RegisterModule, PreparationModule],
  controllers: [NoticesController],
  providers: [NoticesService, NoticePdfService],
  exports: [NoticesService],
})
export class NoticesModule {}
