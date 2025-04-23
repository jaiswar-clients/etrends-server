import { PAYMENT_STATUS_ENUM } from '@/db/schema/amc/amc.schema';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAMCDto {
  @IsNumber()
  amount: number;
}

export class UpdateAMCPaymentDto {
  @IsString()
  @IsOptional()
  from_date: Date;

  @IsString()
  @IsOptional()
  to_date: Date;

  @IsEnum(PAYMENT_STATUS_ENUM)
  @IsOptional()
  status: PAYMENT_STATUS_ENUM;

  @IsString()
  @IsOptional()
  proforma_date: Date;

  @IsString()
  @IsOptional()
  received_date: Date;

  @IsString()
  @IsOptional()
  purchase_order_number?: string;

  @IsNumber()
  @IsOptional()
  total_cost?: number;

  @IsNumber()
  @IsOptional()
  amc_rate_applied?: number;

  @IsNumber()
  @IsOptional()
  amc_rate_amount?: number;

  @IsString()
  @IsOptional()
  purchase_order_document?: string;

  @IsString()
  @IsOptional()
  purchase_order_date?: Date;

  @IsString()
  @IsOptional()
  invoice_document?: string;

  @IsString()
  @IsOptional()
  invoice_number?: string;

  @IsString()
  @IsOptional()
  invoice_date?: Date;
}

export class AddAMCPaymentDto {
  @IsString()
  @IsOptional()
  from_date: Date;

  @IsString()
  @IsOptional()
  to_date: Date;

  @IsEnum(PAYMENT_STATUS_ENUM)
  @IsOptional()
  status: PAYMENT_STATUS_ENUM;

  @IsString()
  @IsOptional()
  received_date: Date;

  @IsNumber()
  @IsOptional()
  amc_rate_applied?: number;

  @IsNumber()
  @IsOptional()
  amc_rate_amount?: number;

  @IsString()
  @IsOptional()
  purchase_order_number?: string;

  @IsString()
  @IsOptional()
  purchase_order_document?: string;

  @IsString()
  @IsOptional()
  purchase_order_date?: Date;

  @IsString()
  @IsOptional()
  invoice_document?: string;

  @IsString()
  @IsOptional()
  invoice_number?: string;

  @IsString()
  @IsOptional()
  invoice_date?: Date;

  @IsNumber()
  @IsOptional()
  total_cost?: number;
}
