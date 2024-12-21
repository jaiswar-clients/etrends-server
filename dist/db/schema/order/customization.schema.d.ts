import { Document, HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
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
    purchase_order_document: string;
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
