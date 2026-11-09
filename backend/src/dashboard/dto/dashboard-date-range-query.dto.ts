import { IsDateString, Matches } from 'class-validator';

export class DashboardDateRangeQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString()
  from!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString()
  to!: string;
}
