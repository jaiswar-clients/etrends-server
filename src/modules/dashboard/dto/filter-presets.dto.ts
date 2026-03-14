import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import { DashboardFiltersDto } from './dashboard-filters.dto';

export class CreateFilterPresetDto {
  @IsString()
  name: string;

  @IsObject()
  filters: DashboardFiltersDto;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateFilterPresetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  filters?: DashboardFiltersDto;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
