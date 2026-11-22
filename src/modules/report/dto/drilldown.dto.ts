// Drill-down tables behind each Revenue Dashboard card.

export const DRILLDOWN_CARDS = [
  'total-revenue',
  'new-sales',
  'amc-revenue',
  'revenue-split',
  'revenue-trend',
  'collection-rate',
  'sales-collection',
  'amc-collection',
  'expected-vs-collected',
  'client-health',
  'client-performance',
  'concentration-risk',
  'expected-revenue',
  'proforma',
  'to-be-created',
] as const;

export type DrilldownCard = (typeof DRILLDOWN_CARDS)[number];

export interface IDrilldownColumn {
  key: string;
  label: string;
  type: 'text' | 'currency' | 'date' | 'status' | 'number' | 'percent';
}

/** Where a drill-down row navigates to in the app (not exported to Excel). */
export interface IRowRef {
  kind:
    | 'order'
    | 'customization'
    | 'license'
    | 'additional_service'
    | 'amc'
    | 'client';
  /** order / item id; for 'amc' the linked order id (AMC page is keyed by order). */
  id: string;
  clientId?: string;
}

export interface IDrilldownResponse {
  card: DrilldownCard;
  title: string;
  subtitle?: string;
  columns: IDrilldownColumn[];
  /** Each row may carry `_ref: IRowRef` for navigation. */
  rows: Record<string, any>[];
  /** Columns the UI offers filter chips for (e.g. ['category', 'status']). */
  filterKeys?: string[];
  /** Column whose values get their own subtotal (e.g. 'category' -> New Order / AMC). */
  subtotalKey?: string;
}

export interface IStreamTotals {
  newSales: number;
  amc: number;
  total: number;
}

/**
 * Revenue Dashboard pipeline cards. Same eligibility as the Total Revenue card
 * (AMC needs order.amc_start_date), so
 * expected = invoiced (Total Revenue) + proforma + toBeCreated.
 */
export interface IRevenuePipelineSummary {
  fiscalYear: string;
  invoiced: IStreamTotals;
  proforma: IStreamTotals;
  toBeCreated: IStreamTotals;
  expected: IStreamTotals;
}

export interface IDrilldownQuery {
  card: DrilldownCard;
  fiscalYear: number;
  filter?: 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';
  orderTypes?: string;
  /** Period label as shown on the chart axis, e.g. "May FY26-27". */
  period?: string;
  /** Per filter column, keep rows whose value is in the list (AND across columns). */
  filters?: Record<string, string[]>;
  /** Case-insensitive match on text / status columns. */
  search?: string;
}
