import { Types } from 'mongoose';
import { CustomizationType } from '@/db/schema/order/customization.schema';
export declare class CreateCustomizationDto {
    product_id: Types.ObjectId;
    cost: number;
    modules: string[];
    title?: string;
    purchase_order_document: string;
    invoice_document: string;
    purchased_date: string;
    type: CustomizationType;
}
