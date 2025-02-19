import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsObject,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { INDUSTRIES_ENUM } from '@/common/types/enums/industry.enum';

class PointOfContactDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  opt_for_email_reminder?: boolean;
}

export class CreateNewClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsOptional()
  @IsEnum([1, 3, 6, 12, 18, 24])
  amc_frequency_in_months?: number;

  @IsOptional()
  @IsObject()
  parent_company?: {
    id: string;
    new: boolean;
    name: string;
  };

  @IsOptional()
  @IsString()
  pan_number?: string;

  @IsOptional()
  @IsString()
  gst_number?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(INDUSTRIES_ENUM)
  industry?: INDUSTRIES_ENUM;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  vendor_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PointOfContactDto)
  point_of_contacts?: PointOfContactDto[];

  @IsOptional()
  @IsArray()
  orders?: any[];
}
