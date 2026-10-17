import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { NoticePreview, RegisterRevision, RegisterView } from '@sahmati/contracts';
import { TenantMembershipGuard } from '../../common/guards/tenant-membership.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RegisterService } from '../services/register.service';
import { RegisterDataDto } from '../dto/register-data.dto';
import { UpdateRegisterEntryDto } from '../dto/update-register-entry.dto';

@Controller('tenants/:tenantId/register')
@UseGuards(TenantMembershipGuard)
export class RegisterController {
  constructor(private readonly register: RegisterService) {}

  @Get()
  list(@Param('tenantId') tenantId: string): Promise<RegisterView[]> {
    return this.register.list(tenantId);
  }

  @Post()
  @Roles('owner', 'staff')
  create(
    @Param('tenantId') tenantId: string,
    @Body() dto: RegisterDataDto,
  ): Promise<RegisterView> {
    return this.register.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles('owner', 'staff')
  update(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRegisterEntryDto,
  ): Promise<RegisterView> {
    const { version, ...data } = dto;
    return this.register.update(tenantId, id, version, data);
  }

  @Get(':id/history')
  history(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ): Promise<RegisterRevision[]> {
    return this.register.history(tenantId, id);
  }

  @Get(':id/notice-preview')
  noticePreview(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query('language') language: 'en' | 'hi' = 'en',
  ): Promise<NoticePreview> {
    return this.register.noticePreview(tenantId, id, language === 'hi' ? 'hi' : 'en');
  }
}
