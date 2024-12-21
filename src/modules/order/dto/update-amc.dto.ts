import { PAYMENT_STATUS_ENUM } from '@/db/schema/amc/amc.schema';
import { IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';

export class UpdateAMCDto {
  @IsString()
  @IsOptional()
  purchase_order_number?: string;

  @IsOptional()
  payments?: {
    from_date: Date;
    to_date: Date;
    status: PAYMENT_STATUS_ENUM;
  }[];

  @IsString()
  @IsOptional()
  purchase_order_document?: string;

  @IsString()
  @IsOptional()
  invoice_document?: string;

  @IsString()
  @IsOptional()
  start_date: string;
}
