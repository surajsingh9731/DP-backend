import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { ConsentOffer, ConsentParticipant, ConsentReceipt } from '@sahmati/contracts';
import { TenantMembershipGuard } from '../../common/guards/tenant-membership.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ConsentSandboxService } from '../services/consent-sandbox.service';
import { CreateOfferDto } from '../dto/create-offer.dto';
import { SubmitChoicesDto, WithdrawChoicesDto } from '../dto/submit-choices.dto';

@Controller('tenants/:tenantId/consent-sandbox')
@UseGuards(TenantMembershipGuard)
export class ConsentSandboxController {
  constructor(private readonly consent: ConsentSandboxService) {}

  @Get('offers')
  listOffers(@Param('tenantId') tenantId: string): Promise<ConsentOffer[]> {
    return this.consent.listOffers(tenantId);
  }

  @Post('offers')
  @Roles('owner', 'staff')
  createOffer(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateOfferDto,
  ): Promise<ConsentOffer> {
    return this.consent.createOffer(tenantId, dto);
  }

  @Get('receipts')
  ledger(@Param('tenantId') tenantId: string): Promise<ConsentReceipt[]> {
    return this.consent.ledger(tenantId);
  }

  @Post('sessions')
  @Roles('owner', 'staff')
  start(
    @Param('tenantId') tenantId: string,
    @Body('offerId') offerId: string,
  ): Promise<ConsentParticipant> {
    return this.consent.startSession(tenantId, offerId);
  }

  @Get('sessions/:id')
  get(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ): Promise<ConsentParticipant> {
    return this.consent.getSession(tenantId, id);
  }

  @Post('sessions/:id/end')
  @HttpCode(200)
  end(@Param('tenantId') tenantId: string, @Param('id') id: string): Promise<void> {
    return this.consent.endSession(tenantId, id);
  }

  @Post('sessions/:id/choices')
  record(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: SubmitChoicesDto,
  ): Promise<ConsentReceipt> {
    return this.consent.recordChoices(tenantId, id, dto);
  }

  @Post('sessions/:id/withdraw')
  withdraw(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: WithdrawChoicesDto,
  ): Promise<ConsentReceipt> {
    return this.consent.withdraw(tenantId, id, dto);
  }
}
