import { IsString } from "class-validator";

export class RemoveStaffDto {
  @IsString()
  idempotencyKey!: string;
}
