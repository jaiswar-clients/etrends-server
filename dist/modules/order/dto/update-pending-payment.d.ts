import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';
export type IPendingPaymentTypes = 'amc' | 'order' | 'license' | 'customization' | 'additional_service';
export declare class UpdatePendingPaymentDto {
    type: IPendingPaymentTypes;
    payment_identifier: string | number;
    status?: PAYMENT_STATUS_ENUM;
    payment_receive_date?: string;
}
