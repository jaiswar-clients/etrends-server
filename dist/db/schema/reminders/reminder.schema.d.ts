import { MAIL_TEMPLATES } from '@/common/mail/service/mail.service';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
export type ReminderDocument = HydratedDocument<Reminder>;
export declare enum COMMUNICATION_TYPE {
    INTERNAL = "internal",
    EXTERNAL = "external"
}
export declare class Reminder extends Document {
    from: string;
    to: string;
    subject: string;
    template: MAIL_TEMPLATES;
    context: any;
    body?: string;
    email_template_id: string;
    communication_type: COMMUNICATION_TYPE;
    status: 'sent' | 'failed';
    client_id: string;
    order_id: string;
    amc_id: string;
    license_id: string;
    customization_id: string;
    reminder_id: string;
    total_attempts: number;
    attachments: {
        filename: string;
        url: string;
        content_type: string;
    }[];
    createdAt?: Date;
    updatedAt?: Date;
}
declare const ReminderSchema: MongooseSchema<Reminder, import("mongoose").Model<Reminder, any, any, any, Document<unknown, any, Reminder> & Reminder & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Reminder, Document<unknown, {}, import("mongoose").FlatRecord<Reminder>> & import("mongoose").FlatRecord<Reminder> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export { ReminderSchema };
