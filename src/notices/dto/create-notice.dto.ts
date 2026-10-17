import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class NoticePreparationInputDto {
  @IsString()
  templateId!: string;

  @IsInt()
  templateVersion!: number;

  @IsString()
  contactId!: string;

  @IsInt()
  contactVersion!: number;
}

export class CreateNoticeDto {
  @IsString()
  entryId!: string;

  @IsInt()
  @Min(0)
  entryVersion!: number;

  @IsIn(['en', 'hi'])
  language!: 'en' | 'hi';

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NoticePreparationInputDto)
  preparation?: NoticePreparationInputDto;
}
