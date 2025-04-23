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
  ALL = 'all',
  PAID = 'paid',
  PENDING = 'pending',
  UPCOMING = 'upcoming',
  OVERDUE = 'overdue',
  PROFORMA = 'proforma',
  INVOICE = 'invoice',
}

export const DEFAULT_AMC_CYCLE_IN_MONTHS = 12;
