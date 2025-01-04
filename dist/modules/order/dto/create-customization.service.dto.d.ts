import { Types } from 'mongoose';
import { CustomizationType } from '@/db/schema/order/customization.schema';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';
export declare class CreateCustomizationDto {
    product_id: Types.ObjectId;
    cost: number;
    payment_status: PAYMENT_STATUS_ENUM;
    payment_receive_date: Date;
    modules: string[];
    title?: string;
    purchase_order_document: string;
    invoice_document: string;
    purchased_date: string;
    type: CustomizationType;
}
