import { ReportService } from '../services/report.service';
import { ReportFilterType } from '@/common/types/enums/report';
export declare class ReportController {
    private readonly reportService;
    constructor(reportService: ReportService);
    getTotalBilling(filter: ReportFilterType, year: string, quarter: string, month: string): Promise<{
        period: string;
        total_amc_billing: number;
        total_purchase_billing: number;
    }[]>;
    getAMCAnnualBreakdown(filter: ReportFilterType, year: string, quarter: string, startDate: string, endDate: string, productId: string): Promise<{
        totalExpected: number;
        totalCollected: number;
        period: string;
    }[]>;
    getExpectedVsReceivedRevenue(filter: ReportFilterType, year: string, quarter: string, month: string): Promise<{
        period: string;
        expected_amount: number;
        received_amount: number;
    }[]>;
    getProductWiseRevenueDistribution(filter: ReportFilterType, year: string, quarter: string, startDate: string, endDate: string): Promise<{
        productId: unknown;
        productName: string;
        revenue: number;
        percentage: number;
        cumulativePercentage: number;
    }[]>;
    getIndustryWiseRevenueDistribution(filter: ReportFilterType, year: string, quarter: string, month: string): Promise<any[]>;
}
