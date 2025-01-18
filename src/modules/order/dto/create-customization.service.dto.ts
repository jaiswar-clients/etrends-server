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
} from 'class-validator';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';

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

  @IsString()
  @IsOptional()
  invoice_number: string;

  @IsString()
  @IsOptional()
  invoice_date: string;

  @IsString()
  invoice_document: string;

  @IsString()
  purchased_date: string;

  @IsEnum(CustomizationType)
  @IsNotEmpty()
  type: CustomizationType;
}
