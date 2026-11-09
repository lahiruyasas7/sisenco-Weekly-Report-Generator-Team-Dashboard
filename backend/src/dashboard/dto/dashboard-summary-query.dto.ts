import { IsDateString, Matches } from 'class-validator';

export class DashboardSummaryQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString()
  weekStart!: string;
}
