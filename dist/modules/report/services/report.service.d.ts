import { CustomizationDocument } from '@/db/schema/order/customization.schema';
import { LicenseDocument } from '@/db/schema/order/license.schema';
import { OrderDocument } from '@/db/schema/order/product-order.schema';
import { SoftDeleteModel } from 'mongoose-delete';
import { ProductDocument } from '@/db/schema/product.schema';
import { LoggerService } from '@/common/logger/services/logger.service';
import { ClientDocument } from '@/db/schema/client.schema';
import { AdditionalServiceDocument } from '@/db/schema/order/additional-service.schema';
import { AMCDocument } from '@/db/schema/amc/amc.schema';
import { ReportFilterOptions, ReportFilterType } from '@/common/types/enums/report';
export declare class ReportService {
    private orderModel;
    private licenseModel;
    private customizationModel;
    private productModel;
    private clientModel;
    private additionalServiceModel;
    private amcModel;
    private readonly loggerService;
    constructor(orderModel: SoftDeleteModel<OrderDocument>, licenseModel: SoftDeleteModel<LicenseDocument>, customizationModel: SoftDeleteModel<CustomizationDocument>, productModel: SoftDeleteModel<ProductDocument>, clientModel: SoftDeleteModel<ClientDocument>, additionalServiceModel: SoftDeleteModel<AdditionalServiceDocument>, amcModel: SoftDeleteModel<AMCDocument>, loggerService: LoggerService);
    getProductWiseRevenueDistribution(filter: ReportFilterType, options?: ReportFilterOptions): Promise<{
        productId: unknown;
        productName: string;
        revenue: number;
        percentage: number;
        cumulativePercentage: number;
    }[]>;
    getIndustryWiseRevenueDistribution(filter: ReportFilterType, options?: ReportFilterOptions & {
        month?: number;
        year?: number;
        quarter?: string;
        productId?: string;
    }): Promise<any[]>;
    private calculateDateRange;
    getTotalBussinessRevenue(filter: ReportFilterType, options?: ReportFilterOptions & {
        month?: number;
        year?: number;
        quarter?: string;
    }): Promise<{
        period: string;
        total_amc_billing: number;
        total_purchase_billing: number;
    }[]>;
    getAMCAnnualBreakdown(filter: ReportFilterType, options?: ReportFilterOptions & {
        productId?: string;
    }): Promise<{
        totalExpected: number;
        totalCollected: number;
        period: string;
    }[]>;
    getExpectedVsReceivedChartData(filter: ReportFilterType, options?: ReportFilterOptions & {
        month?: number;
        year?: number;
        quarter?: string;
    }): Promise<{
        period: string;
        expected_amount: number;
        received_amount: number;
    }[]>;
    fetchIndustryRevenueDistribution(filter: ReportFilterType, options?: ReportFilterOptions & {
        month?: number;
        year?: number;
        quarter?: string;
    }): Promise<any[]>;
    getPieChartSalesData(filter: ReportFilterType, options?: ReportFilterOptions & {
        month?: number;
        year?: number;
        quarter?: string;
    }): Promise<void>;
}
