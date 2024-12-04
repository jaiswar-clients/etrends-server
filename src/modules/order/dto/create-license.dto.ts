import { Type } from 'class-transformer';
import { Types } from 'mongoose';

import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLicenseDto {
  @IsMongoId()
  @IsNotEmpty()
  product_id: Types.ObjectId;

  @IsNumber()
  cost_per_license: number;

  @IsNumber()
  total_license: number;

  @IsString()
  @IsOptional()
  purchase_date: string;

  @IsString()
  @IsOptional()
  purchase_order_document: string;

  @IsString()
  @IsOptional()
  invoice: string;
}
