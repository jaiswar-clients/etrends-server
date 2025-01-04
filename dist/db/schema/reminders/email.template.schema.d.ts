import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
interface DynamicVariable {
    _id: MongooseSchema.Types.ObjectId;
    key: string;
    field: string;
}
export type EmailTemplateDocument = HydratedDocument<EmailTemplate>;
export declare class EmailTemplate extends Document {
    key: string;
    name: string;
    content: string;
    dynamic_variables: DynamicVariable[];
    createdAt?: Date;
    updatedAt?: Date;
}
declare const EmailTemplateSchema: MongooseSchema<EmailTemplate, import("mongoose").Model<EmailTemplate, any, any, any, Document<unknown, any, EmailTemplate> & EmailTemplate & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, EmailTemplate, Document<unknown, {}, import("mongoose").FlatRecord<EmailTemplate>> & import("mongoose").FlatRecord<EmailTemplate> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export { EmailTemplateSchema };
