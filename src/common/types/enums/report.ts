export type ReportFilterType = 'monthly' | 'quarterly' | 'yearly' | 'all';
export type ReportFilterOptions = {
  startDate?: Date;
  endDate?: Date;
  year?: number;
  quarter?: string;
};
