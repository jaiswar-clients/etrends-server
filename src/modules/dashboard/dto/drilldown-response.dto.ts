import { Type } from 'class-transformer';

export class DrillDownMetadataDto {
  drilldownType: string;
  drilldownValue?: string;
  period: string;
  totalRecords: number;
}

export class AggregatedDataRowDto {
  period: string;
  revenue: number;
  orderRevenue: number;
  amcRevenue: number;
  customizationRevenue: number;
  licenseRevenue: number;
  serviceRevenue: number;
}

export class TransactionDetailDto {
  id: string;
  type: 'order' | 'amc' | 'customization' | 'license' | 'service';
  date: Date;
  client: string;
  product?: string;
  amount: number;
  status: string;
  industry?: string;
}

export class PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class DrillDownResponseDto {
  @Type(() => DrillDownMetadataDto)
  metadata: DrillDownMetadataDto;

  @Type(() => AggregatedDataRowDto)
  aggregatedData: AggregatedDataRowDto[];

  @Type(() => TransactionDetailDto)
  details?: TransactionDetailDto[];

  @Type(() => PaginationDto)
  pagination?: PaginationDto;
}
