import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { PreparationRecordView } from '@sahmati/contracts';
import { TenantMembershipGuard } from '../../common/guards/tenant-membership.guard';
import { CurrentMembership } from '../../common/decorators/current-membership.decorator';
import type { CurrentMembership as Membership } from '../../common/guards/tenant-membership.guard';
import { PreparationService } from '../services/preparation.service';
import { SaveTemplateDto } from '../dto/save-template.dto';
import { SaveContactDto } from '../dto/save-contact.dto';
import { PreparationActionDto } from '../dto/preparation-action.dto';

@Controller('tenants/:tenantId/preparation')
@UseGuards(TenantMembershipGuard)
export class PreparationController {
  constructor(private readonly preparation: PreparationService) {}

  @Get()
  list(@Param('tenantId') tenantId: string): Promise<PreparationRecordView[]> {
    return this.preparation.list(tenantId);
  }

  @Get(':id')
  get(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ): Promise<PreparationRecordView> {
    return this.preparation.get(tenantId, id);
  }

  @Post('templates')
  createTemplate(
    @Param('tenantId') tenantId: string,
    @Body() dto: SaveTemplateDto,
    @CurrentMembership() membership: Membership,
  ): Promise<PreparationRecordView> {
    return this.preparation.save(tenantId, 'template', dto, undefined, membership.userId);
  }

  @Put('templates/:id')
  updateTemplate(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: SaveTemplateDto,
    @CurrentMembership() membership: Membership,
  ): Promise<PreparationRecordView> {
    return this.preparation.save(tenantId, 'template', dto, id, membership.userId);
  }

  @Post('contacts')
  createContact(
    @Param('tenantId') tenantId: string,
    @Body() dto: SaveContactDto,
    @CurrentMembership() membership: Membership,
  ): Promise<PreparationRecordView> {
    return this.preparation.save(tenantId, 'contact', dto, undefined, membership.userId);
  }

  @Put('contacts/:id')
  updateContact(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: SaveContactDto,
    @CurrentMembership() membership: Membership,
  ): Promise<PreparationRecordView> {
    return this.preparation.save(tenantId, 'contact', dto, id, membership.userId);
  }

  @Post(':id/actions')
  act(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: PreparationActionDto,
    @CurrentMembership() membership: Membership,
  ): Promise<PreparationRecordView> {
    return this.preparation.act(tenantId, id, dto, membership);
  }
}
