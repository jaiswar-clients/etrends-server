import { Types } from 'mongoose';
import { ORDER_STATUS_ENUM } from '@/common/types/enums/order.enum';
import {
  IsArray,
  IsDate,
  isEmpty,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
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
  @IsOptional()
  date: Date;

  @IsString()
  @IsEnum(PAYMENT_STATUS_ENUM)
  status: PAYMENT_STATUS_ENUM;

  @IsString()
  @IsOptional()
  payment_receive_date: Date;
}

class LicenseDetailsDto {
  @IsNumber()
  cost_per_license: number;

  @IsNumber()
  total_license: number;
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

  @IsObject()
  @IsOptional()
  other_document: {
    title: string;
    url: string;
  };

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
  invoice_document: string;

  @IsString()
  @IsOptional()
  purchase_order_document: string;

  @IsString()
  @IsOptional()
  amc_start_date: Date;

  @ValidateNested()
  @Type(() => LicenseDetailsDto)
  license_details: LicenseDetailsDto;

  @ValidateNested()
  @Type(() => CustomizationDto)
  customization: CustomizationDto;
}
