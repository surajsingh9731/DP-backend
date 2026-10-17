import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { RegisterDataDto } from '../../register/dto/register-data.dto';

export class SaveSetupDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsString()
  organisationName!: string;

  @IsString()
  packId!: string;

  @IsInt()
  packVersion!: number;

  @IsIn([1, 2, 3])
  step!: 1 | 2 | 3;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterDataDto)
  draft!: RegisterDataDto | null;
}
