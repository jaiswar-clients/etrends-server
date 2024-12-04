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
} from 'class-validator';

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

  @IsNumber()
  @IsNotEmpty()
  cost: number;

  @IsString()
  @IsOptional()
  purchase_order_document?: string;

  @IsString()
  @IsOptional()
  service_document?: string;
}
