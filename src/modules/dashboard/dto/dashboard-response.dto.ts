import { Type } from 'class-transformer';

export class DashboardSummaryDto {
  totalRevenue: number;
  amcRevenue: number;
  newBusinessRevenue: number;
  customizationRevenue: number;
  licenseRevenue: number;
  additionalServiceRevenue: number;
  pendingPayments: number;
  paidPayments: number;
  totalClients: number;
  totalOrders: number;
  revenueGrowth: number;
  period: string;
}

export class BillingTrendDto {
  period: string;
  newBusiness: number;
  amc: number;
}

export class ExpectedReceivedDto {
  period: string;
  expected: number;
  received: number;
}

export class AMCBreakdownTrendDto {
  period: string;
  expected: number;
  collected: number;
}

export class DashboardTrendsDto {
  @Type(() => BillingTrendDto)
  totalBilling: BillingTrendDto[];

  @Type(() => ExpectedReceivedDto)
  expectedVsReceived: ExpectedReceivedDto[];

  @Type(() => AMCBreakdownTrendDto)
  amcBreakdown: AMCBreakdownTrendDto[];
}

export class ProductWiseDistributionDto {
  productId: string;
  productName: string;
  revenue: number;
  percentage: number;
}

export class IndustryWiseDistributionDto {
  industry: string;
  revenue: number;
  percentage: number;
}

export class ClientWiseDistributionDto {
  clientId: string;
  clientName: string;
  revenue: number;
}

export class DashboardDistributionsDto {
  @Type(() => ProductWiseDistributionDto)
  productWise: ProductWiseDistributionDto[];

  @Type(() => IndustryWiseDistributionDto)
  industryWise: IndustryWiseDistributionDto[];

  @Type(() => ClientWiseDistributionDto)
  clientWise: ClientWiseDistributionDto[];
}

export class TopProductDto {
  productId: string;
  productName: string;
  revenue: number;
}

export class TopClientDto {
  clientId: string;
  clientName: string;
  revenue: number;
}

export class TopIndustryDto {
  industry: string;
  revenue: number;
}

export class TopPerformersDto {
  @Type(() => TopProductDto)
  topProducts: TopProductDto[];

  @Type(() => TopClientDto)
  topClients: TopClientDto[];

  @Type(() => TopIndustryDto)
  topIndustries: TopIndustryDto[];
}

export class DashboardResponseDto {
  @Type(() => DashboardSummaryDto)
  summary: DashboardSummaryDto;

  @Type(() => DashboardTrendsDto)
  trends: DashboardTrendsDto;

  @Type(() => DashboardDistributionsDto)
  distributions: DashboardDistributionsDto;

  @Type(() => TopPerformersDto)
  topPerformers: TopPerformersDto;
}
