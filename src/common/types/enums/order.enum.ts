export enum ORDER_STATUS_ENUM {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum PURCHASE_TYPE {
  CUSTOMIZATION = 'customization',
  LICENSE = 'license',
  ADDITIONAL_SERVICE = 'additional_service',
  ORDER = 'order',
}

export enum AMC_FILTER {
  PAID = 'paid',
  TO_BE_CREATED = 'to_be_created',
  PROFORMA = 'proforma',
  INVOICE = 'invoice',
}

// Lifecycle: to_be_created -> proforma -> invoice -> paid.
// 'to_be_created' replaced the legacy 'pending' value (see MIGRATIONS.md).
export enum PAYMENT_STATUS_ENUM {
  TO_BE_CREATED = 'to_be_created',
  PROFORMA = 'proforma',
  INVOICE = 'invoice',
  PAID = 'paid',
}

export const PAYMENT_STATUS_LABELS: Record<PAYMENT_STATUS_ENUM, string> = {
  [PAYMENT_STATUS_ENUM.TO_BE_CREATED]: 'To be Created',
  [PAYMENT_STATUS_ENUM.PROFORMA]: 'Proforma',
  [PAYMENT_STATUS_ENUM.INVOICE]: 'Invoice',
  [PAYMENT_STATUS_ENUM.PAID]: 'Paid',
};

export const LEGACY_PENDING_STATUS = 'pending';

/** Maps the legacy 'pending' value (old URLs / clients) to 'to_be_created'. */
export const normalizePaymentStatus = <T extends string>(value: T): T =>
  (value === LEGACY_PENDING_STATUS
    ? PAYMENT_STATUS_ENUM.TO_BE_CREATED
    : value) as T;

export const DEFAULT_AMC_CYCLE_IN_MONTHS = 12;
