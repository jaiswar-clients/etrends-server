export type ReportFilterType = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'all';
export type ReportFilterOptions = {
  startDate?: Date;
  endDate?: Date;
  year?: number;
  quarter?: string;
};
