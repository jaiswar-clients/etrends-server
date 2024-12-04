import { IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';

export class UpdateAMCDto {
  @IsString()
  @IsOptional()
  purchase_order_number?: string;

  @IsNumber()
  @IsOptional()
  @IsEnum([1, 3, 6, 12, 18, 24])
  amc_frequency_in_months?: number;

  @IsString()
  @IsOptional()
  purchase_order_document?: string;

  @IsString()
  @IsOptional()
  invoice_document?: string;

  @IsString()
  @IsOptional()
  start_date: string;
}
