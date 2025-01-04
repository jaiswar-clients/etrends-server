import { IsDate, IsEnum, IsNumber, IsString } from 'class-validator';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';

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

  @IsNumber()
  payment_identifier: string | number;

  @IsEnum(PAYMENT_STATUS_ENUM)
  status?: PAYMENT_STATUS_ENUM;

  @IsString()
  payment_receive_date?: string;
}
