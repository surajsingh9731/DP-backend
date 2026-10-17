import { IsInt, Max, Min } from 'class-validator';
import { TASK_VERSION_LIMITS } from '../constants/workspace.constants.js';
export class CloseTaskDto {
  @IsInt() @Min(TASK_VERSION_LIMITS.minimum) @Max(TASK_VERSION_LIMITS.maximum) version!: number;
}
