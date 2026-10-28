import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReviewAction } from '../../generated/prisma/client.js';

export class ReviewReportDto {
  @IsEnum(ReviewAction)
  action!: ReviewAction;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
