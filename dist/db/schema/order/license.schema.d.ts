import { Document, HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { PAYMENT_STATUS_ENUM } from './product-order.schema';
export type LicenseDocument = HydratedDocument<License>;
export declare class License extends Document {
    product_id: Types.ObjectId;
    order_id: Types.ObjectId;
    rate: {
        percentage: number;
        amount: number;
    };
    payment_status: PAYMENT_STATUS_ENUM;
    payment_receive_date: Date;
    total_license: number;
    purchase_date: Date;
    purchase_order_document: string;
    purchase_order_number: string;
    invoice_number: string;
    invoice_date: Date;
    invoice_document: string;
    createdAt?: Date;
    updatedAt?: Date;
}
declare const LicenseSchema: MongooseSchema<License, import("mongoose").Model<License, any, any, any, Document<unknown, any, License> & License & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, License, Document<unknown, {}, import("mongoose").FlatRecord<License>> & import("mongoose").FlatRecord<License> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export { LicenseSchema };
