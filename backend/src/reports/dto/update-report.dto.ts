import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  Priority,
  TaskStatus,
  TaskType,
} from '../../generated/prisma/client.js';

export class UpdateReportTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  plannedPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  actualPercent?: number;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  spentHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  output?: string;
}

export class UpdateNextWeekTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number;
}

export class UpdateBlockerDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isKey?: boolean;

  @IsOptional()
  @IsBoolean()
  isResolved?: boolean;
}

export class UpdateAchievementDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isKey?: boolean;
}

export class UpdateTimeEntryDto {
  @IsEnum(TaskType)
  taskType!: TaskType;

  @IsNumber()
  @Min(0)
  hours!: number;
}

export class UpdateReportDto {
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateReportTaskDto)
  tasks?: UpdateReportTaskDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateNextWeekTaskDto)
  nextWeekTasks?: UpdateNextWeekTaskDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateBlockerDto)
  blockers?: UpdateBlockerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAchievementDto)
  achievements?: UpdateAchievementDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateTimeEntryDto)
  timeEntries?: UpdateTimeEntryDto[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { each: true },
  )
  links?: string[];
}
