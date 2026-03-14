import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString
} from 'class-validator';
import { DashboardFiltersDto } from './dashboard-filters.dto';

export type DrillDownType = 'product' | 'client' | 'industry' | 'time' | 'amc';
export type AggregationType = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export class DrillDownFiltersDto extends DashboardFiltersDto {
  @IsEnum(['product', 'client', 'industry', 'time', 'amc'])
  drilldownType: DrillDownType;

  @IsString()
  @IsOptional()
  drilldownValue?: string;

  @IsEnum(['daily', 'weekly', 'monthly', 'quarterly'])
  @IsOptional()
  aggregation?: AggregationType;

  @IsBoolean()
  @IsOptional()
  includeDetails?: boolean;

  @IsNumber()
  @IsOptional()
  page?: number;

  @IsNumber()
  @IsOptional()
  limit?: number;
}
