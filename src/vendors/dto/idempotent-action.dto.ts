import { IsString } from "class-validator";

/** Shared shape for state-transition endpoints that take no other input. */
export class IdempotentActionDto {
  @IsString()
  idempotencyKey!: string;
}
