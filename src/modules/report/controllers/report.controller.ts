import { AuthGuard } from '@/common/guards/auth.guard';
import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ReportService } from '../services/report.service';
import { RevenueCalculatorService } from '../services/revenue-calculator.service';
import { ExcelExportService } from '../services/excel-export.service';
import { ReportFilterType } from '@/common/types/enums/report';
import { Response } from 'express';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly revenueCalculatorService: RevenueCalculatorService,
    private readonly excelExportService: ExcelExportService,
  ) {}

  /**
   * @deprecated Use /reports/revenue-dashboard instead
   */
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

  /**
   * @deprecated Use /reports/client-health-dashboard instead
   */
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

  /**
   * @deprecated Use /reports/expected-vs-collected instead
   */
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

  /**
   * @deprecated Use /reports/revenue-dashboard instead
   */
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

  /**
   * @deprecated Use /reports/client-health-dashboard instead
   */
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

  // ==================== NEW REVENUE DASHBOARD ENDPOINTS ====================

  @Get('revenue-dashboard')
  async getRevenueDashboard(
    @Query('filter') filter: 'monthly' | 'quarterly' | 'yearly' | 'all',
    @Query('year') year: string,
    @Query('quarter') quarter: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('orderTypes') orderTypes?: string,
  ) {
    return await this.revenueCalculatorService.getRevenueDashboard({
      filter: filter || 'monthly',
      year: year === 'undefined' || !year ? undefined : Number(year),
      quarter: quarter === 'undefined' || !quarter ? undefined : quarter,
      startDate:
        startDate === 'undefined' || !startDate ? undefined : new Date(startDate),
      endDate:
        endDate === 'undefined' || !endDate ? undefined : new Date(endDate),
      orderTypes: orderTypes === 'undefined' || !orderTypes ? undefined : orderTypes,
    });
  }

  @Get('expected-vs-collected')
  async getExpectedVsCollected(
    @Query('fiscalYear') fiscalYear: string,
    @Query('filter') filter: 'monthly' | 'quarterly' | 'yearly',
    @Query('orderTypes') orderTypes?: string,
  ) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const defaultFiscalYear = currentMonth >= 3 ? currentYear : currentYear - 1;

    return await this.revenueCalculatorService.getExpectedVsCollected({
      fiscalYear: fiscalYear === 'undefined' || !fiscalYear
        ? defaultFiscalYear
        : Number(fiscalYear),
      filter: filter || 'monthly',
      orderTypes: orderTypes === 'undefined' || !orderTypes ? undefined : orderTypes,
    });
  }

  @Get('monthly-revenue-breakdown')
  async getMonthlyRevenueBreakdown(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const now = new Date();
    return await this.revenueCalculatorService.getMonthlyBreakdown({
      year: year === 'undefined' || !year ? now.getFullYear() : Number(year),
      month: month === 'undefined' || !month ? now.getMonth() + 1 : Number(month),
    });
  }

  // ==================== CLIENT HEALTH & RETENTION DASHBOARD ENDPOINT ====================

  @Get('client-health-dashboard')
  async getClientHealthDashboard(
    @Query('fiscalYear') fiscalYear: string,
  ) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const defaultFiscalYear = currentMonth >= 3 ? currentYear : currentYear - 1;

    return await this.revenueCalculatorService.getClientHealthDashboard(
      fiscalYear === 'undefined' || !fiscalYear
        ? defaultFiscalYear
        : Number(fiscalYear),
    );
  }

  // ==================== PENDING PAYMENT BREAKDOWN ENDPOINT ====================

  @Get('pending-breakdown')
  async getPendingBreakdown(
    @Query('fy') fy: string,
    @Query('granularity') granularity: 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' = 'monthly',
  ) {
    return this.reportService.getPendingBreakdownByPeriod({ fy, granularity });
  }

  // ==================== EXCEL EXPORT ENDPOINT ====================

  @Get('export-excel')
  async exportExcelReport(
    @Query('fiscalYear') fiscalYear: string,
    @Query('filter') filter: 'monthly' | 'quarterly',
    @Query('orderTypes') orderTypes: string,
    @Res() res: Response,
  ) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const defaultFiscalYear = currentMonth >= 3 ? currentYear : currentYear - 1;

    const fy = fiscalYear === 'undefined' || !fiscalYear
      ? defaultFiscalYear
      : Number(fiscalYear);

    const ot = orderTypes === 'undefined' || !orderTypes ? undefined : orderTypes;

    // Fetch all data in parallel
    const [revenueDashboard, expectedVsCollected, clientHealth, clientWiseRevenue] = await Promise.all([
      this.revenueCalculatorService.getRevenueDashboard({ filter: filter || 'monthly', year: fy, orderTypes: ot }),
      this.revenueCalculatorService.getExpectedVsCollected({ fiscalYear: fy, filter: filter || 'monthly', orderTypes: ot }),
      this.revenueCalculatorService.getClientHealthDashboard(fy),
      this.revenueCalculatorService.getClientWiseRevenueBreakdown(fy, ot),
    ]);

    // Generate Excel
    const workbook = await this.excelExportService.generateRevenueReport({
      revenueDashboard: revenueDashboard,
      expectedVsCollected: expectedVsCollected,
      clientHealth: clientHealth,
      clientWiseRevenue: clientWiseRevenue,
      fiscalYear: fy,
      filter: filter || 'monthly',
    });

    // Stream response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Revenue_Report_FY_${fy}-${(fy + 1).toString().slice(-2)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }
}
