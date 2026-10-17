import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  VendorDeletionInstructionView,
  VendorView,
} from "@sahmati/contracts";
import { VendorEntity } from "../entities/vendor.entity";
import { VendorDeletionInstructionEntity } from "../entities/vendor-deletion-instruction.entity";
import { RegisterEntryEntity } from "../../register/entities/register-entry.entity";
import { CreateVendorDto } from "../dto/create-vendor.dto";
import { UpdateVendorDto } from "../dto/update-vendor.dto";
import { RecordAgreementSignedDto } from "../dto/record-agreement-signed.dto";
import { IdempotentActionDto } from "../dto/idempotent-action.dto";
import { CreateDeletionInstructionDto } from "../dto/create-deletion-instruction.dto";
import { RecordDeletionOutcomeDto } from "../dto/record-deletion-outcome.dto";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { IdempotencyService } from "../../common/services/idempotency.service";
import { EvidenceLedgerService } from "../../common/services/evidence-ledger.service";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Injectable()
export class VendorsService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly idempotency: IdempotencyService,
    private readonly evidenceLedger: EvidenceLedgerService,
  ) {}

  async create(
    dto: CreateVendorDto,
    session: AuthenticatedSession,
  ): Promise<VendorView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const row = await manager.save(
          manager.create(VendorEntity, {
            tenantId,
            name: dto.name,
            serviceDescription: dto.serviceDescription,
            contactEmail: dto.contactEmail,
            agreementStatus: "not_sent",
          }),
        );
        await this.evidenceLedger.append(manager, {
          tenantId,
          kind: "vendor",
          sourceId: row.id,
          action: "created",
          status: row.agreementStatus,
          actorId: session.userId,
          provenance: "declared",
        });
        return this.toVendorView(row);
      },
    );
  }

  async list(): Promise<VendorView[]> {
    const rows = await this.tenantContext.repo(VendorEntity).find({
      where: { tenantId: this.tenantId() },
      order: { createdAt: "DESC" },
    });
    return rows.map((row) => this.toVendorView(row));
  }

  async get(id: string): Promise<VendorView> {
    return this.toVendorView(await this.vendorOrThrow(id));
  }

  async update(
    id: string,
    dto: UpdateVendorDto,
    session: AuthenticatedSession,
  ): Promise<VendorView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const row = await this.vendorOrThrow(id);
        if (row.version !== dto.version) {
          throw new ConflictException(
            "This vendor changed since you last loaded it.",
          );
        }
        row.name = dto.name;
        row.serviceDescription = dto.serviceDescription;
        row.contactEmail = dto.contactEmail;
        row.version += 1;
        await manager.save(row);
        await this.evidenceLedger.append(manager, {
          tenantId,
          kind: "vendor",
          sourceId: row.id,
          action: "updated",
          status: row.agreementStatus,
          actorId: session.userId,
          provenance: "declared",
        });
        return this.toVendorView(row);
      },
    );
  }

  async sendAgreement(
    id: string,
    dto: IdempotentActionDto,
    session: AuthenticatedSession,
  ): Promise<VendorView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const row = await this.vendorOrThrow(id);
        row.agreementStatus = "sent";
        row.agreementSentAt = new Date();
        await manager.save(row);
        await this.evidenceLedger.append(manager, {
          tenantId,
          kind: "vendor",
          sourceId: row.id,
          action: "agreement_sent",
          status: row.agreementStatus,
          actorId: session.userId,
          provenance: "declared",
        });
        return this.toVendorView(row);
      },
    );
  }

  async recordAgreementSigned(
    id: string,
    dto: RecordAgreementSignedDto,
    session: AuthenticatedSession,
  ): Promise<VendorView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const row = await this.vendorOrThrow(id);
        if (row.agreementStatus === "not_sent") {
          throw new BadRequestException(
            "Send the agreement before recording it as signed.",
          );
        }
        row.agreementStatus = "signed";
        row.agreementSignedAt = new Date();
        row.agreementDocumentRef =
          dto.agreementDocumentRef ?? row.agreementDocumentRef;
        await manager.save(row);
        await this.evidenceLedger.append(manager, {
          tenantId,
          kind: "vendor",
          sourceId: row.id,
          action: "agreement_signed",
          status: row.agreementStatus,
          actorId: session.userId,
          // A signed-document reference is still a staff attestation in R2 —
          // there is no supported e-signature integration to verify it against.
          provenance: "declared",
        });
        return this.toVendorView(row);
      },
    );
  }

  async createDeletionInstruction(
    dto: CreateDeletionInstructionDto,
    session: AuthenticatedSession,
  ): Promise<VendorDeletionInstructionView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        await this.vendorOrThrow(dto.vendorId);
        const registerEntry = await manager
          .getRepository(RegisterEntryEntity)
          .findOne({ where: { id: dto.registerEntryId, tenantId } });
        if (!registerEntry)
          throw new NotFoundException("Register entry not found.");

        const row = await manager.save(
          manager.create(VendorDeletionInstructionEntity, {
            tenantId,
            vendorId: dto.vendorId,
            registerEntryId: dto.registerEntryId,
            instructionText: dto.instructionText,
            status: "pending",
          }),
        );
        await this.evidenceLedger.append(manager, {
          tenantId,
          kind: "vendor_deletion_instruction",
          sourceId: row.id,
          action: "created",
          status: row.status,
          actorId: session.userId,
          provenance: "declared",
        });
        return this.toInstructionView(row);
      },
    );
  }

  async listDeletionInstructions(
    vendorId?: string,
  ): Promise<VendorDeletionInstructionView[]> {
    const tenantId = this.tenantId();
    const where = vendorId ? { tenantId, vendorId } : { tenantId };
    const rows = await this.tenantContext
      .repo(VendorDeletionInstructionEntity)
      .find({ where, order: { createdAt: "DESC" } });
    return rows.map((row) => this.toInstructionView(row));
  }

  async acknowledgeDeletionInstruction(
    id: string,
    dto: IdempotentActionDto,
    session: AuthenticatedSession,
  ): Promise<VendorDeletionInstructionView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const row = await this.instructionOrThrow(id);
        if (row.status !== "pending") {
          throw new BadRequestException(
            "Only a pending instruction can be acknowledged.",
          );
        }
        row.status = "acknowledged";
        row.acknowledgedAt = new Date();
        row.version += 1;
        await manager.save(row);
        await this.evidenceLedger.append(manager, {
          tenantId,
          kind: "vendor_deletion_instruction",
          sourceId: row.id,
          action: "acknowledged",
          status: row.status,
          actorId: session.userId,
          // Proves the vendor acknowledged receiving the instruction — never deletion itself.
          provenance: "declared",
        });
        return this.toInstructionView(row);
      },
    );
  }

  async recordDeletionOutcome(
    id: string,
    dto: RecordDeletionOutcomeDto,
    session: AuthenticatedSession,
  ): Promise<VendorDeletionInstructionView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const row = await this.instructionOrThrow(id);
        if (row.version !== dto.version) {
          throw new ConflictException(
            "This instruction changed since you last loaded it.",
          );
        }
        if (row.status !== "acknowledged") {
          throw new BadRequestException(
            "Only an acknowledged instruction can be resolved.",
          );
        }
        row.status = dto.outcome;
        row.evidenceNote = dto.evidenceNote;
        row.resolvedAt = new Date();
        row.version += 1;
        await manager.save(row);
        await this.evidenceLedger.append(manager, {
          tenantId,
          kind: "vendor_deletion_instruction",
          sourceId: row.id,
          action: dto.outcome,
          status: row.status,
          actorId: session.userId,
          // A vendor's own "done" claim, never system-verified — no supported
          // integration exists in R2 to check an external system's state.
          provenance: "declared",
        });
        return this.toInstructionView(row);
      },
    );
  }

  private async vendorOrThrow(id: string): Promise<VendorEntity> {
    const row = await this.tenantContext
      .repo(VendorEntity)
      .findOne({ where: { id, tenantId: this.tenantId() } });
    if (!row) throw new NotFoundException("Vendor not found.");
    return row;
  }

  private async instructionOrThrow(
    id: string,
  ): Promise<VendorDeletionInstructionEntity> {
    const row = await this.tenantContext
      .repo(VendorDeletionInstructionEntity)
      .findOne({ where: { id, tenantId: this.tenantId() } });
    if (!row) throw new NotFoundException("Deletion instruction not found.");
    return row;
  }

  private tenantId(): string {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId)
      throw new Error(
        "No tenant context — this endpoint requires an authenticated session.",
      );
    return tenantId;
  }

  private toVendorView(row: VendorEntity): VendorView {
    return {
      id: row.id,
      name: row.name,
      serviceDescription: row.serviceDescription,
      contactEmail: row.contactEmail,
      agreementStatus: row.agreementStatus,
      agreementSentAt: row.agreementSentAt?.toISOString() ?? null,
      agreementSignedAt: row.agreementSignedAt?.toISOString() ?? null,
      agreementDocumentRef: row.agreementDocumentRef,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toInstructionView(
    row: VendorDeletionInstructionEntity,
  ): VendorDeletionInstructionView {
    return {
      id: row.id,
      vendorId: row.vendorId,
      registerEntryId: row.registerEntryId,
      instructionText: row.instructionText,
      status: row.status,
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      evidenceNote: row.evidenceNote,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
