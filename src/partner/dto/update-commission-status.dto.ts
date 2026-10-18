import { IsIn } from "class-validator";

export class UpdateCommissionStatusDto {
  @IsIn(["pending", "confirmed", "paid"])
  status!: "pending" | "confirmed" | "paid";
}
