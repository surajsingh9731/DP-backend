import { IsIn, IsInt, IsString, Min } from "class-validator";

export class UpdateStaffRoleDto {
  @IsIn(["owner", "staff", "viewer"])
  role!: "owner" | "staff" | "viewer";

  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  idempotencyKey!: string;
}
