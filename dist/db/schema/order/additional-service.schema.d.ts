import { Document, HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { PAYMENT_STATUS_ENUM } from './product-order.schema';
export type AdditionalServiceDocument = HydratedDocument<AdditionalService>;
export declare class AdditionalService extends Document {
    product_id: Types.ObjectId;
    name: string;
    date: {
        start: Date;
        end: Date;
    };
    cost: number;
    payment_status: PAYMENT_STATUS_ENUM;
    purchased_date: Date;
    payment_receive_date: Date;
    purchase_order_document: string;
    invoice_document: string;
    service_document: string;
    order_id: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}
declare const AdditionalServiceSchema: MongooseSchema<AdditionalService, import("mongoose").Model<AdditionalService, any, any, any, Document<unknown, any, AdditionalService> & AdditionalService & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AdditionalService, Document<unknown, {}, import("mongoose").FlatRecord<AdditionalService>> & import("mongoose").FlatRecord<AdditionalService> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export { AdditionalServiceSchema };
