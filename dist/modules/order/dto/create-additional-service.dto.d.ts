import { Types } from 'mongoose';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';
declare class DateRange {
    start: Date;
    end: Date;
}
export declare class CreateAdditionalServiceDto {
    product_id: Types.ObjectId;
    name: string;
    date: DateRange;
    invoice_document: string;
    payment_status: PAYMENT_STATUS_ENUM;
    payment_receive_date: Date;
    cost: number;
    purchase_order_document?: string;
    service_document?: string;
}
export {};
