import { ORDER_STATUS_ENUM } from '@/common/types/enums/order.enum';
import { Document, HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
export type OrderDocument = HydratedDocument<Order>;
export interface IAMCRate {
    percentage: number;
    amount: number;
}
declare class PaymentTerms {
    name: string;
    percentage_from_base_cost: number;
    calculated_amount: number;
    date: Date;
}
export declare class Order extends Document {
    products: Types.ObjectId[];
    client_id: Types.ObjectId;
    base_cost: number;
    base_cost_seperation: {
        product_id: Types.ObjectId;
        amount: number;
        percentage: number;
    }[];
    amc_rate: IAMCRate;
    amc_id: Types.ObjectId;
    status: ORDER_STATUS_ENUM;
    payment_terms: PaymentTerms[];
    licenses: Types.ObjectId[];
    agreements: {
        _id: any;
        start: Date;
        end: Date;
        document: string;
    }[];
    purchase_order_document: string;
    invoice_document: string;
    purchased_date: Date;
    other_document: {
        title: string;
        url: string;
    };
    customizations: Types.ObjectId[];
    additional_services: Types.ObjectId[];
    amc_start_date: Date;
    createdAt?: Date;
    updatedAt?: Date;
    is_purchased_with_order: {
        customization: boolean;
        license: boolean;
    };
}
declare const OrderSchema: MongooseSchema<Order, import("mongoose").Model<Order, any, any, any, Document<unknown, any, Order> & Order & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Order, Document<unknown, {}, import("mongoose").FlatRecord<Order>> & import("mongoose").FlatRecord<Order> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export { OrderSchema };
