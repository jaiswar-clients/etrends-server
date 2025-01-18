import { Type } from 'class-transformer';
import { Types } from 'mongoose';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';

class DateRange {
  @IsDateString()
  @IsNotEmpty()
  start: Date;

  @IsDateString()
  @IsNotEmpty()
  end: Date;
}

export class CreateAdditionalServiceDto {
  @IsMongoId()
  @IsNotEmpty()
  product_id: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  name: string;

  @ValidateNested()
  @Type(() => DateRange)
  date: DateRange;

  @IsString()
  @IsOptional()
  invoice_document: string;

  @IsString()
  @IsOptional()
  @IsEnum(PAYMENT_STATUS_ENUM)
  payment_status: PAYMENT_STATUS_ENUM;

  @IsString()
  @IsOptional()
  payment_receive_date: Date;

  @IsNumber()
  @IsNotEmpty()
  cost: number;

  @IsString()
  @IsOptional()
  purchase_order_document?: string;

  @IsString()
  @IsOptional()
  purchase_order_number?: string;

  @IsString()
  @IsOptional()
  invoice_number?: string;

  @IsString()
  @IsOptional()
  invoice_date?: string;

  @IsString()
  @IsOptional()
  service_document?: string;
}
