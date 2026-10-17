import { Module } from '@nestjs/common';
import { LocalController } from './local.controller.js';
import { LocalRepository } from './local.repository.js';
import { LocalService } from './local.service.js';
@Module({ controllers: [LocalController], providers: [LocalService, LocalRepository] })
export class LocalModule {}
