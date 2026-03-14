export class FilterOptionDto {
  value: string;
  label: string;
}

export class FilterOptionsResponseDto {
  fiscalYears: FilterOptionDto[];
  quarters: FilterOptionDto[];
  clients: FilterOptionDto[];
  products: FilterOptionDto[];
  industries: FilterOptionDto[];
  revenueStreams: FilterOptionDto[];
  paymentStatuses: FilterOptionDto[];
}
