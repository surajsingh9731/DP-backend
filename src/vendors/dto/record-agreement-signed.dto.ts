import { IsOptional, IsString } from "class-validator";

export class RecordAgreementSignedDto {
  @IsOptional()
  @IsString()
  agreementDocumentRef?: string;

  @IsString()
  idempotencyKey!: string;
}
