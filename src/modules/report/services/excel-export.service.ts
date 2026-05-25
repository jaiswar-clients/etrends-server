import { Injectable } from '@nestjs/common';
import { Workbook, Worksheet, Cell } from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

import {
  IRevenueDashboardResponse,
  IExpectedVsCollectedResponse,
  IClientHealthDashboardResponse,
  IClientWiseRevenueResponse,
} from '../dto/revenue-report.dto';

@Injectable()
export class ExcelExportService {
  // KPMG-style color palette
  private readonly COLORS = {
    navyBlue: 'FF1B365D',
    steelBlue: 'FF4A6FA5',
    lightGray: 'FFF0F2F5',
    white: 'FFFFFFFF',
    gold: 'FFC9A227',
    darkGray: 'FF333333',
    mediumGray: 'FF666666',
    green: 'FF10B981',
    red: 'FFDC2626',
    amber: 'FFF59E0B',
    border: 'FFD1D5DB',
  };

  // Font styles
  private readonly FONTS = {
    header: { name: 'Calibri', size: 11, bold: true, color: { argb: this.COLORS.white } },
    title: { name: 'Calibri', size: 14, bold: true, color: { argb: this.COLORS.navyBlue } },
    subtitle: { name: 'Calibri', size: 12, bold: true, color: { argb: this.COLORS.steelBlue } },
    body: { name: 'Calibri', size: 10, color: { argb: this.COLORS.darkGray } },
    footer: { name: 'Calibri', size: 9, color: { argb: this.COLORS.mediumGray } },
  };

  private getLogoPath(): string | null {
    // Try multiple possible locations for the logo
    const possiblePaths = [
      path.join(__dirname, '../../../assets/logo.png'), // dist/modules/report/services/../../../assets/logo.png -> dist/assets/logo.png
      path.join(__dirname, '../../../../src/assets/logo.png'), // dist/modules/report/services/../../../../src/assets/logo.png -> src/assets/logo.png
      path.join(process.cwd(), 'src/assets/logo.png'), // From project root
      path.join(process.cwd(), 'assets/logo.png'), // From project root (alternative)
    ];

    for (const logoPath of possiblePaths) {
      if (fs.existsSync(logoPath)) {
        return logoPath;
      }
    }

    return null;
  }

  async generateRevenueReport(data: {
    revenueDashboard: IRevenueDashboardResponse;
    expectedVsCollected: IExpectedVsCollectedResponse;
    clientHealth: IClientHealthDashboardResponse;
    clientWiseRevenue: IClientWiseRevenueResponse;
    fiscalYear: number;
    filter: 'monthly' | 'quarterly' | 'half-yearly';
  }): Promise<Workbook> {
    const workbook = new Workbook();
    workbook.creator = 'AMC Management System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Add worksheets
    this.addCoverPage(workbook, data.fiscalYear);
    this.addExecutiveSummary(workbook, data);
    this.addRevenueDashboard(workbook, data.revenueDashboard, data.filter);
    this.addCollectionAnalysis(workbook, data.expectedVsCollected, data.filter);
    this.addClientHealth(workbook, data.clientHealth);
    this.addTopPerformers(workbook, data.clientHealth);
    this.addClientWiseRevenue(workbook, data.clientWiseRevenue);
    this.addConcentrationRisk(workbook, data.clientHealth);
    this.addDetailedData(workbook, data);

    return workbook;
  }

  private addCoverPage(workbook: Workbook, fiscalYear: number): void {
    const sheet = workbook.addWorksheet('Cover', {
      views: [{ showGridLines: false }],
    });

    // Set column widths
    sheet.columns = [{ width: 30 }, { width: 50 }, { width: 30 }];

    // Add logo if exists
    const logoPath = this.getLogoPath();
    if (logoPath) {
      try {
        const logoId = workbook.addImage({
          filename: logoPath,
          extension: 'png',
        });
        sheet.addImage(logoId, {
          tl: { col: 1, row: 2 },
          ext: { width: 150, height: 80 },
        });
      } catch (e) {
        // Logo not found or error loading, continue without it
      }
    }

    // Title section
    const titleRow = 10;
    sheet.mergeCells('B' + titleRow + ':D' + titleRow);
    const titleCell = sheet.getCell('B' + titleRow);
    titleCell.value = 'REVENUE REPORT';
    titleCell.font = { name: 'Calibri', size: 32, bold: true, color: { argb: this.COLORS.navyBlue } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('B' + (titleRow + 2) + ':D' + (titleRow + 2));
    const subtitleCell = sheet.getCell('B' + (titleRow + 2));
    subtitleCell.value = `Fiscal Year ${fiscalYear}-${(fiscalYear + 1).toString().slice(-2)}`;
    subtitleCell.font = { name: 'Calibri', size: 20, bold: false, color: { argb: this.COLORS.steelBlue } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Meta information section
    const infoStartRow = titleRow + 6;
    const infoData = [
      ['Prepared:', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
      ['Classification:', 'Confidential'],
      ['Report Type:', 'Revenue Analysis Dashboard'],
    ];

    infoData.forEach(([label, value], idx) => {
      const row = infoStartRow + idx * 2;
      sheet.mergeCells(`B${row}:C${row}`);
      const labelCell = sheet.getCell(`B${row}`);
      labelCell.value = label as string;
      labelCell.font = this.FONTS.subtitle;
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' };

      const valueCell = sheet.getCell(`D${row}`);
      valueCell.value = value as string;
      valueCell.font = this.FONTS.body;
      valueCell.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    // Footer
    const footerRow = 45;
    sheet.mergeCells(`B${footerRow}:D${footerRow}`);
    const footerCell = sheet.getCell(`B${footerRow}`);
    footerCell.value = '© AMC Management System | Professional Revenue Analysis';
    footerCell.font = this.FONTS.footer;
    footerCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add subtle background
    for (let row = 1; row <= 50; row++) {
      for (let col = 2; col <= 4; col++) {
        const cell = sheet.getCell(row, col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid' as any,
          fgColor: { argb: this.COLORS.white },
        };
      }
    }
  }

  private addExecutiveSummary(workbook: Workbook, data: any): void {
    const sheet = workbook.addWorksheet('Executive Summary');
    sheet.columns = [
      { header: 'Key Performance Indicator', key: 'kpi', width: 35 },
      { header: 'Value', key: 'value', width: 30 },
      { header: 'Insight', key: 'insight', width: 40 },
    ];

    // Style header row
    this.styleHeaderRow(sheet);

    const rd = data.revenueDashboard;
    const evc = data.expectedVsCollected;
    const ch = data.clientHealth;

    const totalRevenue = rd.summary.grandTotalRevenue;
    const collectionRate = evc.total.expected > 0 ? (evc.total.collected / evc.total.expected) * 100 : 0;
    const healthScore = Math.round(
      ch.healthMetrics.activePercentage * 0.3 +
      ch.healthMetrics.amcRenewalRate * 0.3 +
      Math.max(0, 100 - (ch.healthMetrics.overdueClients.over60Days + ch.healthMetrics.overdueClients.over90Days) * 5) * 0.4
    );

    const kpiData = [
      {
        kpi: 'Total Revenue',
        value: this.formatCurrency(totalRevenue),
        insight: `${evc.total.collected >= evc.total.expected ? 'Above' : 'Working towards'} target for the fiscal year`,
      },
      {
        kpi: 'New Sales Revenue',
        value: this.formatCurrency(rd.summary.totalNewSalesRevenue),
        insight: `Represents ${rd.summary.grandTotalRevenue > 0 ? ((rd.summary.totalNewSalesRevenue / rd.summary.grandTotalRevenue) * 100).toFixed(1) : 0}% of total revenue`,
      },
      {
        kpi: 'AMC Revenue',
        value: this.formatCurrency(rd.summary.totalAMCRevenue),
        insight: `Recurring revenue from ${ch.healthMetrics.totalClients} active clients`,
      },
      {
        kpi: 'Collection Rate',
        value: `${collectionRate.toFixed(1)}%`,
        insight: collectionRate >= 80 ? 'Excellent collection performance' : collectionRate >= 60 ? 'Moderate collection - follow up recommended' : 'Critical - immediate attention needed',
      },
      {
        kpi: 'Client Health Score',
        value: `${healthScore}/100`,
        insight: healthScore >= 80 ? 'Healthy client base' : healthScore >= 60 ? 'Some concerns noted' : 'Significant risks identified',
      },
      {
        kpi: 'Active Clients',
        value: `${ch.healthMetrics.activeClients} of ${ch.healthMetrics.totalClients}`,
        insight: `${ch.healthMetrics.activePercentage.toFixed(1)}% client engagement rate`,
      },
      {
        kpi: 'AMC Renewal Rate',
        value: `${ch.healthMetrics.amcRenewalRate.toFixed(1)}%`,
        insight: ch.healthMetrics.amcRenewalRate >= 80 ? 'Strong retention' : 'Renewal strategy review recommended',
      },
      {
        kpi: 'Overdue Payments (>90 days)',
        value: `${ch.healthMetrics.overdueClients.over90Days} clients`,
        insight: ch.healthMetrics.overdueClients.over90Days === 0 ? 'No critical overdue payments' : 'Escalation required',
      },
    ];

    kpiData.forEach((item, idx) => {
      const row = sheet.addRow(item);
      this.styleDataRow(row, idx);
      row.getCell(2).alignment = { horizontal: 'right' };
    });

    // Key insights section
    const insightStartRow = sheet.rowCount + 3;
    sheet.addRow(['Key Insights & Recommendations']);
    const titleRow = sheet.lastRow!;
    titleRow.font = this.FONTS.subtitle;
    titleRow.fill = {
      type: 'pattern',
      pattern: 'solid' as any,
      fgColor: { argb: this.COLORS.lightGray },
    };

    const insights = this.generateInsights(data);
    insights.forEach((insight, idx) => {
      const row = sheet.addRow([idx + 1, insight]);
      row.font = this.FONTS.body;
      row.alignment = { vertical: 'top', wrapText: true };
      row.height = 30;
      row.getCell(1).font = { bold: true, color: { argb: this.COLORS.navyBlue } };
      row.eachCell((cell) => {
        cell.border = this.BORDER_STYLE;
      });
    });

    // Set column widths for insights
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 100;
  }

  private addRevenueDashboard(workbook: Workbook, data: IRevenueDashboardResponse, filter: string): void {
    const sheet = workbook.addWorksheet('Revenue Dashboard');
    sheet.columns = [
      { header: 'Period', key: 'period', width: 20 },
      { header: 'New Sales Revenue', key: 'newSales', width: 22 },
      { header: 'AMC Revenue', key: 'amc', width: 18 },
      { header: 'Total Revenue', key: 'total', width: 20 },
      { header: '% of Total', key: 'percentage', width: 15 },
    ];

    this.styleHeaderRow(sheet);

    const grandTotal = data.summary.grandTotalRevenue;

    data.monthlyBreakdown.forEach((item, idx) => {
      const row = sheet.addRow({
        period: item.period,
        newSales: item.newSalesRevenue,
        amc: item.amcRevenue,
        total: item.totalRevenue,
        percentage: grandTotal > 0 ? `${((item.totalRevenue / grandTotal) * 100).toFixed(1)}%` : '0%',
      });
      this.styleDataRow(row, idx);

      // Format numbers
      row.getCell(2).numFmt = this.CURRENCY_FORMAT;
      row.getCell(3).numFmt = this.CURRENCY_FORMAT;
      row.getCell(4).numFmt = this.CURRENCY_FORMAT;
      row.getCell(2).alignment = { horizontal: 'right' };
      row.getCell(3).alignment = { horizontal: 'right' };
      row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(5).alignment = { horizontal: 'center' };
    });

    // Total row
    const totalRow = sheet.addRow({
      period: 'TOTAL',
      newSales: data.summary.totalNewSalesRevenue,
      amc: data.summary.totalAMCRevenue,
      total: data.summary.grandTotalRevenue,
      percentage: '100%',
    });
    totalRow.font = { bold: true, color: { argb: this.COLORS.navyBlue } };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid' as any,
      fgColor: { argb: 'FFE8EDF2' },
    };
    totalRow.eachCell((cell) => {
      cell.border = this.BORDER_STYLE;
    });
    totalRow.getCell(2).numFmt = this.CURRENCY_FORMAT;
    totalRow.getCell(3).numFmt = this.CURRENCY_FORMAT;
    totalRow.getCell(4).numFmt = this.CURRENCY_FORMAT;
    totalRow.getCell(2).alignment = { horizontal: 'right' };
    totalRow.getCell(3).alignment = { horizontal: 'right' };
    totalRow.getCell(4).alignment = { horizontal: 'right' };
    totalRow.getCell(5).alignment = { horizontal: 'center' };

    // Add chart data reference
    this.addRevenueChart(sheet, data.monthlyBreakdown, sheet.rowCount + 3);
  }

  private addCollectionAnalysis(workbook: Workbook, data: IExpectedVsCollectedResponse, filter: string): void {
    const sheet = workbook.addWorksheet('Collection Analysis');
    sheet.columns = [
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Expected', key: 'expected', width: 20 },
      { header: 'Collected', key: 'collected', width: 20 },
      { header: 'Pending', key: 'pending', width: 20 },
      { header: 'Collection Rate', key: 'rate', width: 18 },
    ];

    this.styleHeaderRow(sheet);

    const categories = [
      { name: 'New Sales', data: data.newSales },
      { name: 'AMC', data: data.amc },
      { name: 'TOTAL', data: data.total },
    ];

    categories.forEach((cat, idx) => {
      const pending = cat.data.expected - cat.data.collected;
      const rate = cat.data.expected > 0 ? (cat.data.collected / cat.data.expected) * 100 : 0;

      const row = sheet.addRow({
        category: cat.name,
        expected: cat.data.expected,
        collected: cat.data.collected,
        pending: pending,
        rate: `${rate.toFixed(1)}%`,
      });

      const isTotal = idx === categories.length - 1;
      if (isTotal) {
        row.font = { bold: true, color: { argb: this.COLORS.navyBlue } };
        row.fill = {
          type: 'pattern',
          pattern: 'solid' as any,
          fgColor: { argb: 'FFE8EDF2' },
        };
      } else {
        this.styleDataRow(row, idx);
      }

      row.eachCell((cell) => {
        cell.border = this.BORDER_STYLE;
      });

      row.getCell(2).numFmt = this.CURRENCY_FORMAT;
      row.getCell(3).numFmt = this.CURRENCY_FORMAT;
      row.getCell(4).numFmt = this.CURRENCY_FORMAT;
      row.getCell(2).alignment = { horizontal: 'right' };
      row.getCell(3).alignment = { horizontal: 'right' };
      row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(5).alignment = { horizontal: 'center' };
    });

    // Period breakdown
    const breakdownStartRow = sheet.rowCount + 3;
    sheet.addRow(['Period-wise Collection Breakdown']);
    const titleRow = sheet.lastRow!;
    titleRow.font = this.FONTS.subtitle;
    titleRow.fill = {
      type: 'pattern',
      pattern: 'solid' as any,
      fgColor: { argb: this.COLORS.lightGray },
    };

    sheet.addRow(['Period', 'Expected', 'Collected', 'Pending', 'Collection Rate']);
    this.styleHeaderRow(sheet.lastRow!);

    // Combine new sales and AMC breakdowns
    const periodMap = new Map<string, { expected: number; collected: number }>();

    data.newSales.breakdown.forEach((item) => {
      periodMap.set(item.period, {
        expected: item.expected,
        collected: item.collected,
      });
    });

    data.amc.breakdown.forEach((item) => {
      const existing = periodMap.get(item.period) || { expected: 0, collected: 0 };
      existing.expected += item.expected;
      existing.collected += item.collected;
      periodMap.set(item.period, existing);
    });

    let rowNum = 0;
    for (const [period, values] of periodMap.entries()) {
      const pending = values.expected - values.collected;
      const rate = values.expected > 0 ? (values.collected / values.expected) * 100 : 0;

      const row = sheet.addRow({
        category: period,
        expected: values.expected,
        collected: values.collected,
        pending: pending,
        rate: `${rate.toFixed(1)}%`,
      });

      this.styleDataRow(row, rowNum++);
      row.eachCell((cell) => {
        cell.border = this.BORDER_STYLE;
      });
      row.getCell(2).numFmt = this.CURRENCY_FORMAT;
      row.getCell(3).numFmt = this.CURRENCY_FORMAT;
      row.getCell(4).numFmt = this.CURRENCY_FORMAT;
      row.getCell(2).alignment = { horizontal: 'right' };
      row.getCell(3).alignment = { horizontal: 'right' };
      row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(5).alignment = { horizontal: 'center' };
    }
  }

  private addClientHealth(workbook: Workbook, data: IClientHealthDashboardResponse): void {
    const sheet = workbook.addWorksheet('Client Health');
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 25 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Description', key: 'description', width: 40 },
    ];

    this.styleHeaderRow(sheet);

    const hm = data.healthMetrics;

    const metrics = [
      {
        metric: 'Total Clients',
        value: hm.totalClients.toString(),
        status: '-',
        description: 'Total registered client base',
      },
      {
        metric: 'Active Clients',
        value: hm.activeClients.toString(),
        status: hm.activePercentage >= 70 ? 'Good' : hm.activePercentage >= 50 ? 'Moderate' : 'Concern',
        description: `${hm.activePercentage.toFixed(1)}% of total clients are active`,
      },
      {
        metric: 'Inactive Clients',
        value: hm.inactiveClients.toString(),
        status: '-',
        description: 'Clients with no activity in the fiscal year',
      },
      {
        metric: 'AMC Renewal Rate',
        value: `${hm.amcRenewalRate.toFixed(1)}%`,
        status: hm.amcRenewalRate >= 80 ? 'Excellent' : hm.amcRenewalRate >= 60 ? 'Good' : 'Needs Attention',
        description: 'Percentage of AMCs renewed on time',
      },
      {
        metric: 'Overdue: 30-60 Days',
        value: hm.overdueClients.over30Days.toString(),
        status: hm.overdueClients.over30Days === 0 ? 'Clear' : 'Follow-up Needed',
        description: 'Clients with payments overdue by 30-60 days',
      },
      {
        metric: 'Overdue: 60-90 Days',
        value: hm.overdueClients.over60Days.toString(),
        status: hm.overdueClients.over60Days === 0 ? 'Clear' : 'Escalate',
        description: 'Clients with payments overdue by 60-90 days',
      },
      {
        metric: 'Overdue: 90+ Days',
        value: hm.overdueClients.over90Days.toString(),
        status: hm.overdueClients.over90Days === 0 ? 'Clear' : 'Critical',
        description: 'Clients with payments overdue by 90+ days',
      },
    ];

    metrics.forEach((item, idx) => {
      const row = sheet.addRow(item);
      this.styleDataRow(row, idx);

      // Color code status
      const statusCell = row.getCell(3);
      const status = item.status.toLowerCase();
      if (status.includes('excellent') || status.includes('good') || status === 'clear') {
        statusCell.font = { color: { argb: this.COLORS.green } };
      } else if (status.includes('moderate') || status.includes('follow-up')) {
        statusCell.font = { color: { argb: this.COLORS.amber } };
      } else if (status.includes('concern') || status.includes('attention') || status.includes('escalate') || status.includes('critical')) {
        statusCell.font = { color: { argb: this.COLORS.red } };
      }

      statusCell.alignment = { horizontal: 'center' };
    });
  }

  private addTopPerformers(workbook: Workbook, data: IClientHealthDashboardResponse): void {
    const sheet = workbook.addWorksheet('Top Performers & Risks');

    // Top performers section
    const topHeaderRow = sheet.addRow(['TOP 10 CLIENTS BY REVENUE']);
    topHeaderRow.font = this.FONTS.subtitle;
    topHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid' as any,
      fgColor: { argb: this.COLORS.navyBlue },
    };
    topHeaderRow.font = { bold: true, color: { argb: this.COLORS.white } };

    sheet.addRow(['Rank', 'Client Name', 'Industry', 'Total Revenue', 'New Sales', 'AMC', 'Orders', 'Trend', 'Change %']);
    this.styleHeaderRow(sheet.lastRow!);

    data.topPerformers.topClients.forEach((client, idx) => {
      const trendIcon = client.trend === 'up' ? '▲' : client.trend === 'down' ? '▼' : '►';
      const row = sheet.addRow({
        rank: idx + 1,
        clientName: client.clientName,
        industry: client.industry,
        totalRevenue: client.totalRevenue,
        newSales: client.newSalesRevenue,
        amc: client.amcRevenue,
        orders: client.orderCount,
        trend: trendIcon,
        changePercentage: `${client.trend === 'up' ? '+' : ''}${client.trendPercentage.toFixed(1)}%`,
      });

      this.styleDataRow(row, idx);
      row.getCell(4).numFmt = this.CURRENCY_FORMAT;
      row.getCell(5).numFmt = this.CURRENCY_FORMAT;
      row.getCell(6).numFmt = this.CURRENCY_FORMAT;
      row.getCell(8).alignment = { horizontal: 'center' };
      row.getCell(9).alignment = { horizontal: 'center' };
      row.getCell(9).font = {
        color: { argb: client.trend === 'up' ? this.COLORS.green : client.trend === 'down' ? this.COLORS.red : this.COLORS.mediumGray },
      };
    });

    // At-risk clients section
    const riskStartRow = sheet.rowCount + 3;
    const riskHeaderRow = sheet.addRow(['AT-RISK CLIENTS']);
    riskHeaderRow.font = this.FONTS.subtitle;
    riskHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid' as any,
      fgColor: { argb: this.COLORS.red },
    };
    riskHeaderRow.font = { bold: true, color: { argb: this.COLORS.white } };

    sheet.addRow(['Client Name', 'Industry', 'Total Revenue', 'Trend', 'Risk Factors']);
    this.styleHeaderRow(sheet.lastRow!);

    data.topPerformers.atRiskClients.forEach((client, idx) => {
      const row = sheet.addRow({
        clientName: client.clientName,
        industry: client.industry,
        totalRevenue: client.totalRevenue,
        trend: client.trend,
        riskFactors: client.riskFactors.join(', '),
      });

      this.styleDataRow(row, idx);
      row.getCell(3).numFmt = this.CURRENCY_FORMAT;
      row.getCell(3).alignment = { horizontal: 'right' };
      row.getCell(5).alignment = { vertical: 'top', wrapText: true };
      row.height = Math.min(30, 15 + client.riskFactors.length * 3);
    });

    // Set column widths
    sheet.columns = [
      { width: 6 },  // Rank
      { width: 30 }, // Client Name
      { width: 20 }, // Industry
      { width: 18 }, // Total Revenue
      { width: 15 }, // New Sales / Trend
      { width: 15 }, // AMC / Change %
      { width: 10 }, // Orders
      { width: 12 }, // Trend
      { width: 12 }, // Change %
    ];
  }

  private addClientWiseRevenue(workbook: Workbook, data: IClientWiseRevenueResponse): void {
    const sheet = workbook.addWorksheet('Client-Wise Revenue', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    sheet.columns = [
      { width: 6 },   // Rank
      { width: 35 },  // Client Name
      { width: 22 },  // Industry
      { width: 20 },  // New Sales Revenue
      { width: 20 },  // AMC Revenue
      { width: 22 },  // Total Revenue
      { width: 15 },  // % of Grand Total
    ];

    const streamLabelMap: Record<string, string> = {
      all: 'All Streams',
      new: 'New Sales Only',
      amc: 'AMC Only',
    };
    const streamLabel = streamLabelMap[(data.orderTypes || 'all').toLowerCase()] || data.orderTypes;

    const titleRow = sheet.addRow(['CLIENT-WISE REVENUE BREAKDOWN']);
    sheet.mergeCells(`A${titleRow.number}:G${titleRow.number}`);
    titleRow.getCell(1).font = { ...this.FONTS.title, size: 14 };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid' as any,
      fgColor: { argb: this.COLORS.navyBlue },
    };
    titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: this.COLORS.white } };
    titleRow.height = 26;

    const metaRow = sheet.addRow([`${data.fiscalYear}  •  Stream: ${streamLabel}  •  Clients: ${data.clients.length}  •  Grand Total: ${this.formatCurrency(data.grandTotal)}`]);
    sheet.mergeCells(`A${metaRow.number}:G${metaRow.number}`);
    metaRow.getCell(1).font = this.FONTS.subtitle;
    metaRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    metaRow.height = 20;

    sheet.addRow([]); // spacer

    const headerRow = sheet.addRow([
      'Rank',
      'Client Name',
      'Industry',
      'New Sales Revenue',
      'AMC Revenue',
      'Total Revenue',
      '% of Grand Total',
    ]);
    this.styleHeaderRow(headerRow);

    data.clients.forEach((client, idx) => {
      const row = sheet.addRow([
        idx + 1,
        client.clientName,
        client.industry,
        client.newSalesRevenue,
        client.amcRevenue,
        client.totalRevenue,
        `${client.percentageOfTotal.toFixed(2)}%`,
      ]);
      this.styleDataRow(row, idx);

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(4).numFmt = this.CURRENCY_FORMAT;
      row.getCell(5).numFmt = this.CURRENCY_FORMAT;
      row.getCell(6).numFmt = this.CURRENCY_FORMAT;
      row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(7).alignment = { horizontal: 'center' };
    });

    if (data.clients.length === 0) {
      const emptyRow = sheet.addRow(['', 'No clients with revenue in selected fiscal year', '', '', '', '', '']);
      sheet.mergeCells(`A${emptyRow.number}:G${emptyRow.number}`);
      emptyRow.getCell(1).alignment = { horizontal: 'center' };
      emptyRow.getCell(1).font = { ...this.FONTS.body, italic: true, color: { argb: this.COLORS.mediumGray } };
    }

    const totalRow = sheet.addRow([
      '',
      'TOTAL',
      '',
      data.totalNewSales,
      data.totalAMC,
      data.grandTotal,
      data.grandTotal > 0 ? '100.00%' : '0.00%',
    ]);
    totalRow.font = { bold: true, color: { argb: this.COLORS.navyBlue } };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid' as any,
      fgColor: { argb: 'FFE8EDF2' },
    };
    totalRow.eachCell((cell) => {
      cell.border = this.BORDER_STYLE;
    });
    totalRow.getCell(4).numFmt = this.CURRENCY_FORMAT;
    totalRow.getCell(5).numFmt = this.CURRENCY_FORMAT;
    totalRow.getCell(6).numFmt = this.CURRENCY_FORMAT;
    totalRow.getCell(4).alignment = { horizontal: 'right' };
    totalRow.getCell(5).alignment = { horizontal: 'right' };
    totalRow.getCell(6).alignment = { horizontal: 'right' };
    totalRow.getCell(7).alignment = { horizontal: 'center' };
  }

  private addConcentrationRisk(workbook: Workbook, data: IClientHealthDashboardResponse): void {
    const sheet = workbook.addWorksheet('Concentration Risk');
    sheet.columns = [
      { header: 'Industry', key: 'industry', width: 30 },
      { header: 'Clients', key: 'clients', width: 12 },
      { header: 'Revenue', key: 'revenue', width: 20 },
      { header: '% of Total', key: 'percentage', width: 15 },
    ];

    this.styleHeaderRow(sheet);

    // Risk level header
    const riskLevel = data.concentrationRisk.riskLevel;
    const riskColor = riskLevel === 'low' ? this.COLORS.green : riskLevel === 'medium' ? this.COLORS.amber : this.COLORS.red;

    const summaryRow = sheet.addRow(['Concentration Risk Summary']);
    summaryRow.font = this.FONTS.subtitle;

    const summaryData = [
      ['Risk Level', riskLevel.toUpperCase(), riskColor],
      ['Herfindahl-Hirschman Index (HHI)', data.concentrationRisk.herfindahlIndex.toFixed(0), ''],
      ['Top 10 Clients Revenue Share', `${data.concentrationRisk.top10Percentage.toFixed(1)}%`, ''],
      ['Total Revenue', this.formatCurrency(data.concentrationRisk.totalRevenue), ''],
    ];

    summaryData.forEach(([label, value, color]) => {
      const row = sheet.addRow([label, value]);
      row.font = this.FONTS.body;
      row.getCell(1).font = { bold: true, color: { argb: this.COLORS.steelBlue } };
      if (color) {
        row.getCell(2).font = { bold: true, color: { argb: color as string } };
      }
    });

    sheet.addRow([]); // Empty row

    // Industry breakdown header
    sheet.addRow(['Industry Diversification']);
    sheet.lastRow!.font = this.FONTS.subtitle;

    sheet.addRow(['Industry', 'Clients', 'Revenue', '% of Total']);
    this.styleHeaderRow(sheet.lastRow!);

    data.concentrationRisk.industryDiversification.forEach((item, idx) => {
      const row = sheet.addRow({
        industry: item.industry,
        clients: item.clientCount,
        revenue: item.totalRevenue,
        percentage: `${item.percentage.toFixed(1)}%`,
      });

      this.styleDataRow(row, idx);
      row.getCell(3).numFmt = this.CURRENCY_FORMAT;
      row.getCell(3).alignment = { horizontal: 'right' };
      row.getCell(4).alignment = { horizontal: 'center' };
    });
  }

  private addDetailedData(workbook: Workbook, data: any): void {
    const sheet = workbook.addWorksheet('Detailed Data');

    // Revenue breakdown by period
    sheet.addRow(['REVENUE BREAKDOWN BY PERIOD']);
    sheet.lastRow!.font = this.FONTS.subtitle;

    sheet.addRow(['Period', 'New Sales Revenue', 'AMC Revenue', 'Total Revenue']);
    this.styleHeaderRow(sheet.lastRow!);

    data.revenueDashboard.monthlyBreakdown.forEach((item: any, idx: number) => {
      const row = sheet.addRow({
        period: item.period,
        newSalesRevenue: item.newSalesRevenue,
        amcRevenue: item.amcRevenue,
        totalRevenue: item.totalRevenue,
      });

      this.styleDataRow(row, idx);
      row.getCell(2).numFmt = this.CURRENCY_FORMAT;
      row.getCell(3).numFmt = this.CURRENCY_FORMAT;
      row.getCell(4).numFmt = this.CURRENCY_FORMAT;
    });

    // Collection breakdown
    const collectionStart = sheet.rowCount + 3;
    sheet.addRow(['COLLECTION BREAKDOWN']);
    sheet.lastRow!.font = this.FONTS.subtitle;

    sheet.addRow(['Category', 'Expected', 'Collected', 'Collection Rate']);
    this.styleHeaderRow(sheet.lastRow!);

    [
      { name: 'New Sales', data: data.expectedVsCollected.newSales },
      { name: 'AMC', data: data.expectedVsCollected.amc },
      { name: 'Total', data: data.expectedVsCollected.total },
    ].forEach((item) => {
      const rate = item.data.expected > 0 ? (item.data.collected / item.data.expected) * 100 : 0;
      const row = sheet.addRow({
        category: item.name,
        expected: item.data.expected,
        collected: item.data.collected,
        collectionRate: `${rate.toFixed(1)}%`,
      });

      row.font = this.FONTS.body;
      row.eachCell((cell) => {
        cell.border = this.BORDER_STYLE;
      });
      row.getCell(2).numFmt = this.CURRENCY_FORMAT;
      row.getCell(3).numFmt = this.CURRENCY_FORMAT;
    });

    // Client health summary
    const healthStart = sheet.rowCount + 3;
    sheet.addRow(['CLIENT HEALTH SUMMARY']);
    sheet.lastRow!.font = this.FONTS.subtitle;

    const hm = data.clientHealth.healthMetrics;
    const healthData = [
      ['Total Clients', hm.totalClients],
      ['Active Clients', hm.activeClients],
      ['Inactive Clients', hm.inactiveClients],
      ['Active Percentage', `${hm.activePercentage.toFixed(1)}%`],
      ['AMC Renewal Rate', `${hm.amcRenewalRate.toFixed(1)}%`],
      ['Overdue 30-60 Days', hm.overdueClients.over30Days],
      ['Overdue 60-90 Days', hm.overdueClients.over60Days],
      ['Overdue 90+ Days', hm.overdueClients.over90Days],
    ];

    healthData.forEach(([label, value]) => {
      const row = sheet.addRow([label, value]);
      row.font = this.FONTS.body;
      row.getCell(1).font = { bold: true, color: { argb: this.COLORS.steelBlue } };
      row.eachCell((cell) => {
        cell.border = this.BORDER_STYLE;
      });
    });

    // Set column widths
    sheet.columns = [{ width: 30 }, { width: 20 }, { width: 20 }, { width: 20 }];
  }

  private addRevenueChart(sheet: Worksheet, data: any[], startRow: number): void {
    // Note: ExcelJS doesn't support adding charts directly in the current version
    // This method is a placeholder for future chart support
    // For now, we'll add a chart data reference section
    sheet.addRow(['Chart Data Reference']);
    const titleRow = sheet.lastRow!;
    titleRow.font = this.FONTS.subtitle;
  }

  private generateInsights(data: any): string[] {
    const insights = [];
    const rd = data.revenueDashboard;
    const evc = data.expectedVsCollected;
    const ch = data.clientHealth;

    // Revenue insights
    const newSalesPercentage = rd.summary.grandTotalRevenue > 0
      ? (rd.summary.totalNewSalesRevenue / rd.summary.grandTotalRevenue) * 100
      : 0;

    if (newSalesPercentage > 50) {
      insights.push('Strong new sales performance contributing ' + newSalesPercentage.toFixed(1) + '% of total revenue. Focus on maintaining sales momentum.');
    } else {
      insights.push('AMC revenue constitutes ' + (100 - newSalesPercentage).toFixed(1) + '% of total. Consider strategies to boost new sales acquisition.');
    }

    // Collection insights
    const collectionRate = evc.total.expected > 0 ? (evc.total.collected / evc.total.expected) * 100 : 0;
    if (collectionRate < 70) {
      insights.push('Collection rate at ' + collectionRate.toFixed(1) + '% requires immediate attention. Implement follow-up process for pending payments.');
    } else if (collectionRate < 85) {
      insights.push('Collection rate at ' + collectionRate.toFixed(1) + '% - monitor overdue accounts and accelerate collections.');
    }

    // Client health insights
    if (ch.healthMetrics.overdueClients.over90Days > 0) {
      insights.push(ch.healthMetrics.overdueClients.over90Days + ' clients with 90+ days overdue. Escalate to management for recovery action.');
    }

    if (ch.healthMetrics.amcRenewalRate < 70) {
      insights.push('AMC renewal rate at ' + ch.healthMetrics.amcRenewalRate.toFixed(1) + '% - review renewal strategy and client engagement.');
    }

    // Concentration risk
    if (ch.concentrationRisk.riskLevel === 'high') {
      insights.push('High concentration risk (HHI: ' + ch.concentrationRisk.herfindahlIndex.toFixed(0) + '). Diversify client base to reduce dependency.');
    }

    // At-risk clients
    if (ch.topPerformers.atRiskClients.length > 0) {
      insights.push(ch.topPerformers.atRiskClients.length + ' clients identified as at-risk. Assign account managers for retention.');
    }

    return insights.length > 0 ? insights : ['Business operating within normal parameters. Continue monitoring key metrics.'];
  }

  private styleHeaderRow(rowOrSheet: any): void {
    const row = rowOrSheet.eachCell ? rowOrSheet : rowOrSheet.getRow(1);
    row.eachCell((cell: Cell) => {
      cell.font = this.FONTS.header;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid' as any,
        fgColor: { argb: this.COLORS.navyBlue },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.BORDER_STYLE;
    });
    if (rowOrSheet.height) {
      rowOrSheet.height = 22;
    }
  }

  private styleDataRow(row: any, index: number): void {
    row.eachCell((cell: Cell) => {
      cell.font = this.FONTS.body;
      cell.border = this.BORDER_STYLE;
      if (index % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid' as any,
          fgColor: { argb: this.COLORS.lightGray },
        };
      }
    });
  }

  private readonly BORDER_STYLE = {
    top: { style: 'thin' as const, color: { argb: this.COLORS.border } },
    left: { style: 'thin' as const, color: { argb: this.COLORS.border } },
    bottom: { style: 'thin' as const, color: { argb: this.COLORS.border } },
    right: { style: 'thin' as const, color: { argb: this.COLORS.border } },
  };

  private readonly CURRENCY_FORMAT = '"₹"#,##0.00';

  private formatCurrency(value: number): string {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    } else {
      return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
  }

  private getDefaultFiscalYear(): number {
    const now = new Date();
    const currentMonth = now.getMonth();
    return currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  }
}
