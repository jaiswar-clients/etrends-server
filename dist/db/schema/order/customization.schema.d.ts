import { Document, HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { PAYMENT_STATUS_ENUM } from './product-order.schema';
export type CustomizationDocument = HydratedDocument<Customization>;
export declare enum CustomizationType {
    MODULE = "module",
    REPORT = "report",
    CUSTOMIZATION = "customization"
}
export declare class Customization extends Document {
    product_id: Types.ObjectId;
    order_id: Types.ObjectId;
    cost: number;
    modules: string[];
    reports: string[];
    title: string;
    type: CustomizationType;
    purchased_date: Date;
    payment_status: PAYMENT_STATUS_ENUM;
    payment_receive_date: Date;
    purchase_order_document: string;
    purchase_order_number: string;
    invoice_number: string;
    invoice_date: Date;
    invoice_document: string;
    createdAt?: Date;
    updatedAt?: Date;
}
declare const CustomizationSchema: MongooseSchema<Customization, import("mongoose").Model<Customization, any, any, any, Document<unknown, any, Customization> & Customization & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Customization, Document<unknown, {}, import("mongoose").FlatRecord<Customization>> & import("mongoose").FlatRecord<Customization> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export { CustomizationSchema };
