import { IsInt, Min } from "class-validator";
import { CreateRegisterEntryDto } from "./create-register-entry.dto";

export class UpdateRegisterEntryDto extends CreateRegisterEntryDto {
  @IsInt()
  @Min(1)
  version!: number;
}
