import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RegisterController } from './register.controller.js';
import { RegisterService } from './register.service.js';
import { RegisterRepository } from './register.repository.js';
@Module({
  imports: [AuthModule],
  providers: [RegisterService, RegisterRepository],
  controllers: [RegisterController],
})
export class RegisterModule {}
