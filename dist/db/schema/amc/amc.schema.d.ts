import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
export type AMCDocument = HydratedDocument<AMC>;
export declare enum PAYMENT_STATUS_ENUM {
    PAID = "paid",
    PENDING = "pending",
    PARTIAL = "partial"
}
export declare class AMC extends Document {
    order_id: MongooseSchema.Types.ObjectId;
    client_id: MongooseSchema.Types.ObjectId;
    total_cost: number;
    start_date: Date;
    payments: {
        _id: any;
        from_date: Date;
        to_date: Date;
        status: PAYMENT_STATUS_ENUM;
        received_date: Date;
        purchase_order_number: string;
        purchase_order_document: string;
        purchase_order_date: Date;
        invoice_document: string;
        invoice_number: string;
        invoice_date: Date;
    }[];
    amount: number;
    amc_percentage: number;
    products: MongooseSchema.Types.ObjectId[];
    createdAt?: Date;
    updatedAt?: Date;
}
declare const AMCSchema: MongooseSchema<AMC, import("mongoose").Model<AMC, any, any, any, Document<unknown, any, AMC> & AMC & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AMC, Document<unknown, {}, import("mongoose").FlatRecord<AMC>> & import("mongoose").FlatRecord<AMC> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export { AMCSchema };
