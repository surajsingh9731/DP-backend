import { IsString } from "class-validator";

export class PublishNoticeDto {
  @IsString()
  idempotencyKey!: string;
}
