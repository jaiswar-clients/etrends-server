import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export type ReportFilterType = 'monthly' | 'quarterly' | 'yearly' | 'all' | 'custom';
export type RevenueStream = 'order' | 'amc' | 'customization' | 'license' | 'service';
export type PaymentStatus = 'paid' | 'pending' | 'proforma' | 'invoice';

export class DashboardFiltersDto {
  @IsEnum(['monthly', 'quarterly', 'yearly', 'all', 'custom'])
  filter: ReportFilterType;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null) ? parseInt(value, 10) : undefined)
  fiscalYear?: number;

  @IsString()
  @IsOptional()
  quarter?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  clientIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  productIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  industries?: string[];

  @IsArray()
  @IsEnum(['order', 'amc', 'customization', 'license', 'service'], { each: true })
  @IsOptional()
  revenueStreams?: RevenueStream[];

  @IsArray()
  @IsEnum(['paid', 'pending', 'proforma', 'invoice'], { each: true })
  @IsOptional()
  paymentStatuses?: PaymentStatus[];
}
