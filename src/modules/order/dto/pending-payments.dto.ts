import { IsOptional, IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PendingPaymentsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  product_id?: string;

  @IsOptional()
  @IsString()
  type?: string; // comma-separated: 'new_order,customization,auditor_licence,amc'
}
