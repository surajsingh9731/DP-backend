import { ArrayMinSize, IsArray, IsInt, Min } from "class-validator";

export class SubmitQuizDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  answers!: number[];
}
