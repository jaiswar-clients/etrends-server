import { AuthGuard } from '@/common/guards/auth.guard';
import { BadRequestException, Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ReportService } from '../services/report.service';
import { RevenueCalculatorService } from '../services/revenue-calculator.service';
import { ExcelExportService } from '../services/excel-export.service';
import { DashboardDrilldownService } from '../services/dashboard-drilldown.service';
import { DrilldownCard, IDrilldownQuery } from '../dto/drilldown.dto';
import { ReportFilterType } from '@/common/types/enums/report';
import { Response } from 'express';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly revenueCalculatorService: RevenueCalculatorService,
    private readonly excelExportService: ExcelExportService,
    private readonly drilldownService: DashboardDrilldownService,
  ) {}

  private parseDrilldownQuery(q: Record<string, string | undefined>): IDrilldownQuery {
    const clean = (v?: string) => (v && v !== 'undefined' && v !== 'null' ? v : undefined);
    const now = new Date();
    const defaultFiscalYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fy = clean(q.fiscalYear);
    // filters = JSON {"status":["paid"],"category":["AMC"]}
    let filters: Record<string, string[]> | undefined;
    const rawFilters = clean(q.filters);
    if (rawFilters) {
      try {
        const parsed = JSON.parse(rawFilters);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          filters = Object.fromEntries(
            Object.entries(parsed)
              .filter(([, v]) => Array.isArray(v))
              .map(([k, v]) => [k, (v as unknown[]).map(String)]),
          );
        }
      } catch {
        throw new BadRequestException('filters must be a JSON object of string arrays');
      }
    }
    return {
      card: q.card as DrilldownCard,
      fiscalYear: fy ? Number(fy) : defaultFiscalYear,
      filter: (clean(q.filter) as IDrilldownQuery['filter']) || 'monthly',
      orderTypes: clean(q.orderTypes),
      period: clean(q.period),
      filters,
      search: clean(q.search),
    };
  }

  /** Drill-down rows behind a Revenue Dashboard card. */
  @Get('drilldown')
  async getDrilldown(@Query() q: Record<string, string>) {
    return await this.drilldownService.getDrilldown(this.parseDrilldownQuery(q));
  }

  /** Expected Revenue / Proforma / To be Created card values. */
  @Get('revenue-pipeline')
  async getRevenuePipeline(@Query() q: Record<string, string>) {
    const { fiscalYear, orderTypes } = this.parseDrilldownQuery(q);
    return await this.drilldownService.getPipelineSummary({ fiscalYear, orderTypes });
  }

  /** Excel dump of the same drill-down table (honours filters / search). */
  @Get('drilldown/export')
  async exportDrilldown(@Query() q: Record<string, string>, @Res() res: Response) {
    const query = this.parseDrilldownQuery(q);
    const table = await this.drilldownService.getDrilldown(query);
    const workbook = await this.drilldownService.buildWorkbook(table);
    const fy = `FY_${query.fiscalYear}-${(query.fiscalYear + 1).toString().slice(-2)}`;
    const period = query.period ? `_${query.period.replace(/[^A-Za-z0-9-]+/g, '_')}` : '';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${query.card}${period}_${fy}.xlsx`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    await workbook.xlsx.write(res);
    res.end();
  }

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
    @Query('filter') filter: 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'all',
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
    @Query('filter') filter: 'monthly' | 'quarterly' | 'half-yearly' | 'yearly',
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

  // ==================== EXCEL EXPORT ENDPOINT ====================

  @Get('export-excel')
  async exportExcelReport(
    @Query('fiscalYear') fiscalYear: string,
    @Query('filter') filter: 'monthly' | 'quarterly' | 'half-yearly',
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
