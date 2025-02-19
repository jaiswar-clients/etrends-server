import { Document, HydratedDocument, Types } from 'mongoose';
export type ClientDocument = HydratedDocument<Client>;
declare class PointOfContact {
    name: string;
    email: string;
    designation: string;
    phone: string;
    opt_for_email_reminder: boolean;
}
export declare class Client extends Document {
    name: string;
    parent_company_id: Types.ObjectId;
    pan_number: string;
    gst_number: string;
    address: string;
    industry: string;
    client_id: string;
    amc_frequency_in_months: number;
    vendor_id: string;
    is_parent_company: boolean;
    child_companies: Types.ObjectId[];
    point_of_contacts: PointOfContact[];
    orders: Types.ObjectId[];
    remark: string;
    amcs: Types.ObjectId[];
}
declare const ClientSchema: import("mongoose").Schema<Client, import("mongoose").Model<Client, any, any, any, Document<unknown, any, Client> & Client & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Client, Document<unknown, {}, import("mongoose").FlatRecord<Client>> & import("mongoose").FlatRecord<Client> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export { ClientSchema };
