import { IsIn } from 'class-validator';
import { TeamWeekQueryDto } from './team-week-query.dto.js';

export const TEAM_SECTIONS = [
  'blockers',
  'achievements',
  'nextWeek',
  'notes',
] as const;

export type TeamSection = (typeof TEAM_SECTIONS)[number];

export class TeamSectionsQueryDto extends TeamWeekQueryDto {
  @IsIn(TEAM_SECTIONS)
  section!: TeamSection;
}
