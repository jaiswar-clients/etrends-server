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
    getDetailedOverallSalesReport(filter: ReportFilterType, options?: ReportFilterOptions): Promise<{
        orderRevenue: number;
        customizationRevenue: number;
        licenseRevenue: number;
        additionalServiceRevenue: number;
        amcRevenue: number;
        total: number;
        period: string;
    }[]>;
    getAMCRevenueReport(filter: ReportFilterType, options?: ReportFilterOptions): Promise<{
        period: string;
        total: number;
    }[]>;
    getProductWiseRevenueDistribution(filter: ReportFilterType, options?: ReportFilterOptions): Promise<{
        productId: unknown;
        productName: string;
        revenue: number;
        percentage: number;
        cumulativePercentage: number;
    }[]>;
    getAMCAnnualBreakdown(filter: ReportFilterType, options?: ReportFilterOptions & {
        productId?: string;
    }): Promise<{
        totalExpected: number;
        totalCollected: number;
        period: string;
    }[]>;
    getIndustryWiseRevenueDistribution(filter: ReportFilterType, options?: ReportFilterOptions & {
        month?: number;
        year?: number;
        quarter?: string;
        productId?: string;
    }): Promise<any[]>;
}
