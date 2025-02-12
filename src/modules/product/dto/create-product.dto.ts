import {
  IsString,
  IsBoolean,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  short_name: string;

  @IsBoolean()
  does_have_license: boolean;

  @IsNumber()
  @IsOptional()
  default_number_of_licenses: number;

  @IsArray()
  @IsOptional()
  modules: { name: string; key: string; description: string }[];

  @IsArray()
  @IsOptional()
  reports: { name: string; key: string; description: string }[];

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
