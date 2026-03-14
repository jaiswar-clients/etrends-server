import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service';
import { DashboardFiltersDto } from '../dto/dashboard-filters.dto';
import { DrillDownFiltersDto } from '../dto/drilldown-filters.dto';
import { DashboardResponseDto } from '../dto/dashboard-response.dto';
import { DrillDownResponseDto } from '../dto/drilldown-response.dto';
import { FilterOptionsResponseDto } from '../dto/filter-options.dto';
import { AuthGuard } from '@/common/guards/auth.guard';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Query() filters: DashboardFiltersDto): Promise<{ message: string; data: DashboardResponseDto; success: boolean }> {
    const result = await this.dashboardService.getDashboardData(filters);
    return { message: 'Dashboard data retrieved successfully', data: result, success: true };
  }

  @Get('drilldown')
  async getDrillDown(@Query() filters: DrillDownFiltersDto): Promise<{ message: string; data: DrillDownResponseDto; success: boolean }> {
    const result = await this.dashboardService.getDrillDownData(filters);
    return { message: 'Drill-down data retrieved successfully', data: result, success: true };
  }

  @Get('filter-options')
  async getFilterOptions(): Promise<{ message: string; data: FilterOptionsResponseDto; success: boolean }> {
    const result = await this.dashboardService.getFilterOptions();
    return { message: 'Filter options retrieved successfully', data: result, success: true };
  }
}
