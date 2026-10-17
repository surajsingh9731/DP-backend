import { IsString } from "class-validator";

export class ReleaseHoldDto {
  @IsString()
  idempotencyKey!: string;
}
