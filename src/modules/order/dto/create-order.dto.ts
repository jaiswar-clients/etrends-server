import { Types } from 'mongoose';
import { ORDER_STATUS_ENUM } from '@/common/types/enums/order.enum';
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
import { Type } from 'class-transformer';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';

class PaymentTermsDto {
  @IsString()
  name: string;

  @IsNumber()
  percentage_from_base_cost: number;

  @IsNumber()
  calculated_amount: number;

  @IsString()
  @IsEnum(PAYMENT_STATUS_ENUM)
  status: PAYMENT_STATUS_ENUM;

  @IsString()
  @IsOptional()
  payment_receive_date: Date;

  @IsString()
  @IsOptional()
  invoice_document: string; // cdn url

  @IsString()
  @IsOptional()
  invoice_number: string;

  @IsString()
  @IsOptional()
  invoice_date: string;
}

class AmcRateDto {
  @IsNumber()
  percentage: number;

  @IsNumber()
  amount: number;
}

class CustomizationDto {
  @IsNumber()
  cost: number;

  @IsArray()
  @IsString({ each: true })
  modules: string[];
}

export class CreateOrderDto {
  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty()
  products: Types.ObjectId[];

  @IsArray()
  @IsOptional()
  other_documents: {
    title: string;
    url: string;
  }[];

  @IsNumber()
  base_cost: number;

  @ValidateNested()
  @Type(() => AmcRateDto)
  amc_rate: AmcRateDto;

  @IsEnum(ORDER_STATUS_ENUM)
  status: ORDER_STATUS_ENUM;

  @IsString()
  purchased_date: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentTermsDto)
  payment_terms: PaymentTermsDto[];

  @IsOptional()
  @IsArray()
  base_cost_seperation: {
    product_id: Types.ObjectId;
    amount: number;
    percentage: number;
  }[];

  @IsOptional()
  @IsArray()
  agreements: {
    start: Date;
    end: Date;
    document: string;
  }[];

  @IsString()
  @IsOptional()
  purchase_order_document: string;

  @IsString()
  @IsOptional()
  purchase_order_number: string;

  @IsString()
  @IsOptional()
  amc_start_date: Date;

  @IsNumber()
  @IsOptional()
  cost_per_license: number;

  @IsNumber()
  @IsOptional()
  licenses_with_base_price: number;

  @ValidateNested()
  @Type(() => CustomizationDto)
  customization: CustomizationDto;
}
