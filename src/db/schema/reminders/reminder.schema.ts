import { MAIL_TEMPLATES } from '@/common/mail/service/mail.service';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

// Define the document type for TypeScript
export type ReminderDocument = HydratedDocument<Reminder>;

export enum COMMUNICATION_TYPE {
  INTERNAL = 'internal', // means the reminder is sent to internal team members
  EXTERNAL = 'external', // means the reminder is sent to external clients
}

// Main schema
@Schema({ timestamps: true })
export class Reminder extends Document {
  @Prop({ type: String, required: true })
  from: string;

  @Prop({ type: String, required: true })
  to: string;

  @Prop({ type: String, required: true })
  subject: string;

  @Prop({ type: String, enum: MAIL_TEMPLATES })
  template: MAIL_TEMPLATES;

  @Prop({ type: Object, required: true, default: {} })
  context: any;

  @Prop({ type: String })
  body?: string; // if the communication is external we can simply track the body of the email

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'EmailTemplate' })
  email_template_id: string; // if the communication is external we can track the email template used

  @Prop({
    type: String,
    default: COMMUNICATION_TYPE.INTERNAL,
    enum: COMMUNICATION_TYPE,
  })
  communication_type: COMMUNICATION_TYPE;

  @Prop({
    type: String,
    default: 'sent',
    enum: ['sent', 'failed', 'skipped'],
  })
  status: 'sent' | 'failed' | 'skipped';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Client' })
  client_id: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Order' })
  order_id: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Amc' })
  amc_id: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'License' })
  license_id: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Customization' })
  customization_id: string;

  @Prop({ type: String })
  reminder_id: string; // this will be used as a unique identifier for the reminder, so that we don't send same reminder for the same user multiple times

  @Prop({ type: Number, default: 1 })
  total_attempts: number;

  @Prop({
    type: [
      {
        filename: String,
        url: String,
        content_type: String,
      },
    ],
    default: [],
  })
  attachments: {
    filename: string;
    url: string;
    content_type: string;
  }[];

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

// Define schema with plugins and virtuals as needed
const ReminderSchema = SchemaFactory.createForClass(Reminder);
ReminderSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
ReminderSchema.set('toObject', { virtuals: true });
ReminderSchema.set('toJSON', { virtuals: true });

export { ReminderSchema };
