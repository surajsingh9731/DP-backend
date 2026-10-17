import { IsInt, Min } from 'class-validator';
import { RegisterDataDto } from './register-data.dto';

export class UpdateRegisterEntryDto extends RegisterDataDto {
  @IsInt()
  @Min(0)
  version!: number;
}
