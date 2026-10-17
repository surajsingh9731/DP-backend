import { IsInt, Min } from 'class-validator';

export class CloseTaskDto {
  @IsInt()
  @Min(0)
  version!: number;
}
