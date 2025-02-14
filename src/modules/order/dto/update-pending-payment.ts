import { IsDate, IsEnum, IsNumber, IsString, ValidateIf } from 'class-validator';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';
import { Transform } from 'class-transformer';

export type IPendingPaymentTypes =
  | 'amc'
  | 'order'
  | 'license'
  | 'customization'
  | 'additional_service';

export class UpdatePendingPaymentDto {
  @IsString()
  @IsEnum(['amc', 'order', 'license', 'customization', 'additional_service'])
  type: IPendingPaymentTypes;

  @Transform(({ value }) => (isNaN(value) ? value : Number(value)))
  @ValidateIf((_, value) => typeof value === 'number')
  @IsNumber()
  @ValidateIf((_, value) => typeof value === 'string')
  @IsString()
  payment_identifier: string | number;

  @IsEnum(PAYMENT_STATUS_ENUM)
  status?: PAYMENT_STATUS_ENUM;

  @IsString()
  payment_receive_date?: string;
}
