import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

export class DashboardTasksTrendQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString()
  from!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString()
  to!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
