import {
  PAYMENT_STATUS_ENUM,
  normalizePaymentStatus,
} from '@/common/types/enums/order.enum';

/**
 * Payment terms for standalone licenses / customizations.
 *
 * Licenses and customizations carry `payment_terms` (same shape as order
 * terms). Items saved before terms existed have none: they are treated as one
 * 100% term built from their legacy item-level fields, so every report works
 * on "one row per term" for both shapes.
 */
export interface IItemPaymentTerm {
  name?: string;
  percentage_from_base_cost?: number | string;
  calculated_amount?: number;
  invoice_number?: string;
  invoice_date?: Date | string | null;
  invoice_document?: string;
  status?: string;
  payment_receive_date?: Date | string | null;
}

/** null = explicitly cleared on save (e.g. receive date once a term is unpaid again). */
export interface IPaymentTermsSummary {
  payment_status: PAYMENT_STATUS_ENUM;
  invoice_number: string | null;
  invoice_date: Date | null;
  invoice_document: string | null;
  payment_receive_date: Date | null;
}

const toDate = (v: unknown): Date | undefined => {
  if (!v) return undefined;
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? undefined : d;
};

/** Amount split by a license's terms. */
export const licenseBaseAmount = (license: any): number =>
  (license?.rate?.amount || 0) * (license?.total_license || 0);

/** Amount split by a customization's terms. */
export const customizationBaseAmount = (customization: any): number =>
  customization?.cost || 0;

/** One 100% term from an item's legacy (pre-terms) fields. */
export function legacyPaymentTerm(
  item: any,
  baseAmount: number,
): IItemPaymentTerm {
  return {
    name: 'Full Payment',
    percentage_from_base_cost: 100,
    calculated_amount: baseAmount,
    invoice_number: item?.invoice_number,
    invoice_date: item?.invoice_date ?? null,
    invoice_document: item?.invoice_document,
    status: normalizePaymentStatus(
      item?.payment_status || PAYMENT_STATUS_ENUM.TO_BE_CREATED,
    ),
    payment_receive_date: item?.payment_receive_date ?? null,
  };
}

/** The item's terms, or one virtual 100% term for items without terms. */
export function effectivePaymentTerms(
  item: any,
  baseAmount: number,
): IItemPaymentTerm[] {
  if (Array.isArray(item?.payment_terms) && item.payment_terms.length > 0) {
    return item.payment_terms;
  }
  return [legacyPaymentTerm(item, baseAmount)];
}

/** Term amount; falls back to percentage × base when calculated_amount is missing. */
export function termAmount(term: IItemPaymentTerm, baseAmount: number): number {
  if (typeof term.calculated_amount === 'number') return term.calculated_amount;
  const pct = Number(term.percentage_from_base_cost) || 0;
  return (baseAmount * pct) / 100;
}

/**
 * Item-level summary of its terms (kept on the item for list filters and old screens):
 * - payment_status: paid when every term is paid; invoice when any term is
 *   invoiced or paid; proforma when any term is proforma; else to_be_created.
 * - invoice_*: from the earliest invoiced term.
 * - payment_receive_date: latest receive date, only when fully paid.
 */
export function summarizePaymentTerms(
  terms: IItemPaymentTerm[],
): IPaymentTermsSummary {
  const statuses = terms.map((t) =>
    normalizePaymentStatus(t.status || PAYMENT_STATUS_ENUM.TO_BE_CREATED),
  );
  const payment_status =
    statuses.length > 0 && statuses.every((s) => s === PAYMENT_STATUS_ENUM.PAID)
      ? PAYMENT_STATUS_ENUM.PAID
      : statuses.some(
            (s) =>
              s === PAYMENT_STATUS_ENUM.INVOICE || s === PAYMENT_STATUS_ENUM.PAID,
          )
        ? PAYMENT_STATUS_ENUM.INVOICE
        : statuses.some((s) => s === PAYMENT_STATUS_ENUM.PROFORMA)
          ? PAYMENT_STATUS_ENUM.PROFORMA
          : PAYMENT_STATUS_ENUM.TO_BE_CREATED;

  const invoiced = terms
    .filter((t) => toDate(t.invoice_date))
    .sort(
      (a, b) =>
        toDate(a.invoice_date)!.getTime() - toDate(b.invoice_date)!.getTime(),
    );
  const first = invoiced[0];
  const receiveDates = terms
    .map((t) => toDate(t.payment_receive_date))
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    payment_status: payment_status as PAYMENT_STATUS_ENUM,
    invoice_number: first?.invoice_number || null,
    invoice_date: toDate(first?.invoice_date) ?? null,
    invoice_document: first?.invoice_document || null,
    payment_receive_date:
      payment_status === PAYMENT_STATUS_ENUM.PAID ? (receiveDates[0] ?? null) : null,
  };
}

/**
 * Normalize terms coming from the API (dates → Date, status normalized,
 * amount derived from percentage when missing). With no terms, builds one
 * 100% term from the legacy body fields so old API callers keep working.
 */
export function buildPaymentTerms(
  body: any,
  baseAmount: number,
): { payment_terms: IItemPaymentTerm[] } & IPaymentTermsSummary {
  const raw: IItemPaymentTerm[] =
    Array.isArray(body?.payment_terms) && body.payment_terms.length > 0
      ? body.payment_terms
      : [legacyPaymentTerm(body, baseAmount)];
  const payment_terms = raw.map((t, i) => ({
    name: t.name || (raw.length === 1 ? 'Full Payment' : `Term ${i + 1}`),
    percentage_from_base_cost: Number(t.percentage_from_base_cost) || 0,
    calculated_amount: termAmount(t, baseAmount),
    invoice_number: t.invoice_number || undefined,
    invoice_date: toDate(t.invoice_date) ?? null,
    invoice_document: t.invoice_document || undefined,
    status: normalizePaymentStatus(
      t.status || PAYMENT_STATUS_ENUM.TO_BE_CREATED,
    ),
    payment_receive_date: toDate(t.payment_receive_date) ?? null,
  }));
  return { payment_terms, ...summarizePaymentTerms(payment_terms) };
}

/**
 * Mongo filter: standalone items that may hold a term dated in [start, end]
 * (legacy invoice_date, any term invoice_date, or the purchase date used for
 * not-yet-invoiced terms).
 */
export function standaloneTermsDateFilter(
  start: Date,
  end: Date,
  purchaseField?: 'purchased_date' | 'purchase_date',
) {
  const range = { $gte: start, $lte: end };
  return {
    deleted: { $ne: true },
    $or: [
      { invoice_date: range },
      { 'payment_terms.invoice_date': range },
      ...(purchaseField ? [{ [purchaseField]: range }] : []),
    ],
  };
}
