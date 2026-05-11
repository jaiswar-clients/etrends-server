// Revenue Report DTOs

// Monthly Revenue Breakdown
export interface IMonthlyRevenueBreakdown {
  period: string;
  newSalesRevenue: number;
  amcRevenue: number;
  totalRevenue: number;
}

// Revenue Dashboard Response
export interface IRevenueDashboardResponse {
  summary: {
    totalNewSalesRevenue: number;
    totalAMCRevenue: number;
    grandTotalRevenue: number;
  };
  monthlyBreakdown: IMonthlyRevenueBreakdown[];
}

// Period Breakdown for Expected vs Collected
export interface IPeriodBreakdown {
  period: string;
  expected: number;
  collected: number;
}

// Expected vs Collected Response
export interface IExpectedVsCollectedResponse {
  fiscalYear: string;
  newSales: {
    expected: number;
    collected: number;
    breakdown: IPeriodBreakdown[];
  };
  amc: {
    expected: number;
    collected: number;
    breakdown: IPeriodBreakdown[];
  };
  total: {
    expected: number;
    collected: number;
  };
}

// Monthly Breakdown Detail
export interface IMonthlyBreakdownDetail {
  orderId: string;
  clientName: string;
  productName: string;
  amount: number;
  status: string;
  date: Date;
}

export interface IMonthlyBreakdown {
  period: string;
  newSales: {
    total: number;
    details: IMonthlyBreakdownDetail[];
  };
  amc: {
    total: number;
    details: IMonthlyBreakdownDetail[];
  };
}

// Query DTOs
export interface IRevenueDashboardQuery {
  filter?: 'monthly' | 'quarterly' | 'yearly' | 'all';
  year?: number;
  quarter?: string;
  startDate?: Date;
  endDate?: Date;
  orderTypes?: string; // comma-separated: 'new','amc','customization','auditor'
}

export interface IExpectedVsCollectedQuery {
  fiscalYear: number; // Start year of fiscal year (e.g., 2024 for FY24-25)
  filter?: 'monthly' | 'quarterly' | 'yearly';
  orderTypes?: string; // comma-separated: 'new','amc','customization','auditor'
}

export interface IMonthlyBreakdownQuery {
  year: number;
  month: number; // 1-12
}

// ==================== CLIENT HEALTH & RETENTION DASHBOARD TYPES ====================

export interface IClientHealthMetrics {
  totalClients: number;
  activeClients: number;
  inactiveClients: number;
  activePercentage: number;
  overdueClients: {
    over30Days: number;
    over60Days: number;
    over90Days: number;
  };
  amcRenewalRate: number;
}

export interface IClientRevenueData {
  clientId: string;
  clientName: string;
  industry: string;
  totalRevenue: number;
  newSalesRevenue: number;
  amcRevenue: number;
  orderCount: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  isAtRisk: boolean;
  riskFactors: string[];
}

export interface ITopPerformersResponse {
  topClients: IClientRevenueData[];
  atRiskClients: IClientRevenueData[];
}

export interface IIndustryBreakdown {
  industry: string;
  clientCount: number;
  totalRevenue: number;
  percentage: number;
}

export interface IClientConcentrationRisk {
  totalRevenue: number;
  top10ClientsRevenue: number;
  top10Percentage: number;
  herfindahlIndex: number;
  riskLevel: 'low' | 'medium' | 'high';
  industryDiversification: IIndustryBreakdown[];
}

export interface IClientHealthDashboardResponse {
  healthMetrics: IClientHealthMetrics;
  topPerformers: ITopPerformersResponse;
  concentrationRisk: IClientConcentrationRisk;
  fiscalYear: string;
}

// ==================== CLIENT-WISE REVENUE BREAKDOWN TYPES ====================

export interface IClientWiseRevenue {
  clientId: string;
  clientName: string;
  industry: string;
  newSalesRevenue: number;
  amcRevenue: number;
  totalRevenue: number;
  percentageOfTotal: number;
}

export interface IClientWiseRevenueResponse {
  fiscalYear: string;
  orderTypes: string;
  clients: IClientWiseRevenue[];
  grandTotal: number;
  totalNewSales: number;
  totalAMC: number;
}
