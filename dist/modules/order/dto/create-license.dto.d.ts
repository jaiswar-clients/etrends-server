import { Types } from 'mongoose';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';
export declare class CreateLicenseDto {
    product_id: Types.ObjectId;
    licenses_with_base_price: number;
    cost_per_license: number;
    total_license: number;
    purchase_date: string;
    payment_status: PAYMENT_STATUS_ENUM;
    payment_receive_date: Date;
    purchase_order_document: string;
    purchase_order_number: string;
    invoice_number: string;
    invoice_date: string;
    invoice_document: string;
}
