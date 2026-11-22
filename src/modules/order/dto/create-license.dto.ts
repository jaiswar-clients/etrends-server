import { Type } from 'class-transformer';
import { Types } from 'mongoose';

import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';
import { PaymentTermsDto } from './create-order.dto';

export class CreateLicenseDto {
  @IsMongoId()
  @IsNotEmpty()
  product_id: Types.ObjectId;

  @IsNumber()
  @IsOptional()
  licenses_with_base_price: number;

  @IsNumber()
  cost_per_license: number;

  @IsNumber()
  total_license: number;

  @IsString()
  @IsOptional()
  purchase_date: string;

  @IsString()
  @IsOptional()
  @IsEnum(PAYMENT_STATUS_ENUM)
  payment_status: PAYMENT_STATUS_ENUM;

  @IsString()
  @IsOptional()
  payment_receive_date: Date;

  @IsString()
  @IsOptional()
  purchase_order_document: string;

  @IsString()
  @IsOptional()
  purchase_order_number: string;

  // Legacy single-invoice fields; payment_terms supersede them when sent.
  @IsString()
  @IsOptional()
  invoice_number: string;

  @IsString()
  @IsOptional()
  invoice_date: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PaymentTermsDto)
  payment_terms?: PaymentTermsDto[];

  @IsString()
  @IsOptional()
  invoice_document: string;

  @IsNumber()
  @IsOptional()
  amc_percentage: number;
}
