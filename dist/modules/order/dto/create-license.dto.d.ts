import { Types } from 'mongoose';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';
export declare class CreateLicenseDto {
    product_id: Types.ObjectId;
    cost_per_license: number;
    total_license: number;
    purchase_date: string;
    payment_status: PAYMENT_STATUS_ENUM;
    payment_receive_date: Date;
    purchase_order_document: string;
    invoice: string;
}
