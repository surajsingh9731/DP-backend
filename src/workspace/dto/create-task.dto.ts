import { IsIn, IsString } from "class-validator";

export class CreateTaskDto {
  @IsIn(["review_inventory"])
  template!: "review_inventory";

  @IsString()
  idempotencyKey!: string;

  @IsIn(["en", "hi"])
  language!: "en" | "hi";
}
