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

export class CreateCustomizationDto {
  @IsMongoId()
  @IsNotEmpty()
  product_id: Types.ObjectId;

  @IsNumber()
  @IsNotEmpty()
  cost: number;

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
  invoice_document: string;

  @IsString()
  purchased_date: string;

  @IsEnum(CustomizationType)
  @IsNotEmpty()
  type: CustomizationType;
}
