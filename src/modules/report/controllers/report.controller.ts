import { AuthGuard } from '@/common/guards/auth.guard';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportService } from '../services/report.service';
import { ReportFilterType } from '@/common/types/enums/report';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('total-billing')
  async getTotalBilling(
    @Query('filter') filter: ReportFilterType,
    @Query('year') year: string,
    @Query('quarter') quarter: string,
    @Query('month') month: string,
  ) {
    return await this.reportService.getTotalBussinessRevenue(filter, {
      year: year === 'undefined' ? undefined : Number(year),
      quarter: year === 'undefined' ? undefined : quarter,
      month: month === 'undefined' ? undefined : Number(month),
    });
  }

  @Get('amc-annual-breakdown')
  async getAMCAnnualBreakdown(
    @Query('filter') filter: ReportFilterType,
    @Query('year') year: string,
    @Query('quarter') quarter: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('productId') productId: string,
  ) {
    return await this.reportService.getAMCAnnualBreakdown(filter, {
      startDate:
        startDate === 'undefined' || !startDate
          ? undefined
          : new Date(startDate),
      endDate:
        endDate === 'undefined' || !endDate ? undefined : new Date(endDate),
      year: year === 'undefined' || !year ? undefined : Number(year),
      quarter: year === 'undefined' || !year ? undefined : quarter,
      productId:
        productId === 'undefined' || !productId ? undefined : productId,
    });
  }

  @Get('expected-vs-received-revenue')
  async getExpectedVsReceivedRevenue(
    @Query('filter') filter: ReportFilterType,
    @Query('year') year: string,
    @Query('quarter') quarter: string,
    @Query('month') month: string,
  ) {
    return await this.reportService.getExpectedVsReceivedChartData(filter, {
      year: year === 'undefined' ? undefined : Number(year),
      quarter: year === 'undefined' ? undefined : quarter,
      month: month === 'undefined' ? undefined : Number(month),
    });
  }

  @Get('product-wise-revenue-distribution')
  async getProductWiseRevenueDistribution(
    @Query('filter') filter: ReportFilterType,
    @Query('year') year: string,
    @Query('quarter') quarter: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.reportService.getProductWiseRevenueDistribution(filter, {
      startDate: startDate === 'undefined' ? undefined : new Date(startDate),
      endDate: endDate === 'undefined' ? undefined : new Date(endDate),
      year: year === 'undefined' ? undefined : Number(year),
      quarter: year === 'undefined' ? undefined : quarter,
    });
  }

  @Get('industry-wise-revenue-distribution')
  async getIndustryWiseRevenueDistribution(
    @Query('filter') filter: ReportFilterType,
    @Query('year') year: string,
    @Query('quarter') quarter: string,
    @Query('month') month: string,
  ) {
    return await this.reportService.fetchIndustryRevenueDistribution(filter, {
      year: year === 'undefined' ? undefined : Number(year),
      quarter: year === 'undefined' ? undefined : quarter,
      month: month === 'undefined' ? undefined : Number(month),
    });
  }
}
