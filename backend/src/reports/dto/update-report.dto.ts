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
  registerDecorator,
  Min,
  type ValidationOptions,
  ValidateNested,
} from 'class-validator';
import {
  Priority,
  TaskStatus,
  TaskType,
} from '../../generated/prisma/client.js';

function IsQuarterHour(validationOptions?: ValidationOptions) {
  return (target: object, propertyName: string): void => {
    registerDecorator({
      name: 'isQuarterHour',
      target: target.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          // Scaling by four avoids floating-point remainder checks for quarter hours.
          return (
            typeof value === 'number' &&
            Number.isFinite(value) &&
            Number.isInteger(value * 4)
          );
        },
        defaultMessage(): string {
          return 'Hours must be in 0.25-hour increments.';
        },
      },
    });
  };
}

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
  @IsQuarterHour()
  plannedHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @IsQuarterHour()
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
  @IsQuarterHour()
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
  @IsQuarterHour()
  hours!: number;
}

export class UpdateReportDto {
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UpdateReportTaskDto)
  tasks?: UpdateReportTaskDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UpdateNextWeekTaskDto)
  nextWeekTasks?: UpdateNextWeekTaskDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UpdateBlockerDto)
  blockers?: UpdateBlockerDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UpdateAchievementDto)
  achievements?: UpdateAchievementDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
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
