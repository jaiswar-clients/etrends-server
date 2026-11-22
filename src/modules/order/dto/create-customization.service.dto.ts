import { Types } from 'mongoose';
import { CustomizationType } from '@/db/schema/order/customization.schema';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';
import { PaymentTermsDto } from './create-order.dto';

export class CreateCustomizationDto {
  @IsMongoId()
  @IsNotEmpty()
  product_id: Types.ObjectId;

  @IsNumber()
  @IsNotEmpty()
  cost: number;

  @IsString()
  @IsOptional()
  @IsEnum(PAYMENT_STATUS_ENUM)
  payment_status: PAYMENT_STATUS_ENUM;

  @IsString()
  @IsOptional()
  payment_receive_date: Date;

  @IsArray()
  @IsString({ each: true })
  modules: string[];

  @IsString()
  @IsOptional()
  title?: string;

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

  @IsString()
  @IsOptional()
  invoice_document: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PaymentTermsDto)
  payment_terms?: PaymentTermsDto[];

  @IsString()
  purchased_date: string;

  @IsEnum(CustomizationType)
  @IsNotEmpty()
  type: CustomizationType;

  @IsNumber()
  @IsOptional()
  amc_percentage: number;
}
