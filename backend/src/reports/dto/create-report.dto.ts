import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateReportDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  weekStart!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
