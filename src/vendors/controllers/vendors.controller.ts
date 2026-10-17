import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import type {
  VendorDeletionInstructionView,
  VendorView,
} from "@sahmati/contracts";
import { VendorsService } from "../services/vendors.service";
import { CreateVendorDto } from "../dto/create-vendor.dto";
import { UpdateVendorDto } from "../dto/update-vendor.dto";
import { RecordAgreementSignedDto } from "../dto/record-agreement-signed.dto";
import { IdempotentActionDto } from "../dto/idempotent-action.dto";
import { CreateDeletionInstructionDto } from "../dto/create-deletion-instruction.dto";
import { RecordDeletionOutcomeDto } from "../dto/record-deletion-outcome.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Controller("vendors")
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Get()
  list(): Promise<VendorView[]> {
    return this.vendors.list();
  }

  // Registered before ":id" so "/vendors/deletion-instructions" doesn't
  // get shadowed by the single-segment ":id" route below.
  @Get("deletion-instructions")
  listDeletionInstructions(
    @Query("vendorId") vendorId?: string,
  ): Promise<VendorDeletionInstructionView[]> {
    return this.vendors.listDeletionInstructions(vendorId);
  }

  @Roles("owner", "staff")
  @Post("deletion-instructions")
  createDeletionInstruction(
    @Body() dto: CreateDeletionInstructionDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<VendorDeletionInstructionView> {
    return this.vendors.createDeletionInstruction(dto, session);
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<VendorView> {
    return this.vendors.get(id);
  }

  @Roles("owner", "staff")
  @Post()
  create(
    @Body() dto: CreateVendorDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<VendorView> {
    return this.vendors.create(dto, session);
  }

  @Roles("owner", "staff")
  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<VendorView> {
    return this.vendors.update(id, dto, session);
  }

  @Roles("owner", "staff")
  @Post(":id/agreement/send")
  sendAgreement(
    @Param("id") id: string,
    @Body() dto: IdempotentActionDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<VendorView> {
    return this.vendors.sendAgreement(id, dto, session);
  }

  @Roles("owner", "staff")
  @Post(":id/agreement/signed")
  recordAgreementSigned(
    @Param("id") id: string,
    @Body() dto: RecordAgreementSignedDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<VendorView> {
    return this.vendors.recordAgreementSigned(id, dto, session);
  }

  @Roles("owner", "staff")
  @Post("deletion-instructions/:id/acknowledge")
  acknowledgeDeletionInstruction(
    @Param("id") id: string,
    @Body() dto: IdempotentActionDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<VendorDeletionInstructionView> {
    return this.vendors.acknowledgeDeletionInstruction(id, dto, session);
  }

  @Roles("owner", "staff")
  @Post("deletion-instructions/:id/outcome")
  recordDeletionOutcome(
    @Param("id") id: string,
    @Body() dto: RecordDeletionOutcomeDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<VendorDeletionInstructionView> {
    return this.vendors.recordDeletionOutcome(id, dto, session);
  }
}
