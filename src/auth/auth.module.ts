import { Module } from '@nestjs/common';
import { TenantAuthorizationService } from './tenant-authorization.service.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './guards/session.guard.js';
import { TenantGuard } from './guards/tenant.guard.js';
@Module({
  providers: [AuthService, AuthRepository, SessionGuard, TenantGuard, TenantAuthorizationService],
  controllers: [AuthController],
  exports: [SessionGuard, TenantGuard, AuthRepository, TenantAuthorizationService],
})
export class AuthModule {}
