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
}

export interface IExpectedVsCollectedQuery {
  fiscalYear: number; // Start year of fiscal year (e.g., 2024 for FY24-25)
}

export interface IMonthlyBreakdownQuery {
  year: number;
  month: number; // 1-12
}
