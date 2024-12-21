import { ReportService } from '../services/report.service';
import { ReportFilterType } from '@/common/types/enums/report';
export declare class ReportController {
    private readonly reportService;
    constructor(reportService: ReportService);
    getOverallSalesReport(filter: ReportFilterType, year: string, quarter: string, startDate: string, endDate: string): Promise<{
        orderRevenue: number;
        customizationRevenue: number;
        licenseRevenue: number;
        additionalServiceRevenue: number;
        amcRevenue: number;
        total: number;
        period: string;
    }[]>;
    getAMCRevenueReport(filter: ReportFilterType, year: string, quarter: string, startDate: string, endDate: string): Promise<{
        period: string;
        total: number;
    }[]>;
    getProductWiseRevenueDistribution(filter: ReportFilterType, year: string, quarter: string, startDate: string, endDate: string): Promise<{
        productId: unknown;
        productName: string;
        revenue: number;
        percentage: number;
        cumulativePercentage: number;
    }[]>;
    getAMCAnnualBreakdown(filter: ReportFilterType, year: string, quarter: string, startDate: string, endDate: string, productId: string): Promise<{
        totalExpected: number;
        totalCollected: number;
        period: string;
    }[]>;
    getIndustryWiseRevenueDistribution(filter: ReportFilterType, year: string, quarter: string, month: string): Promise<any[]>;
}
