import { MAIL_TEMPLATES } from '@/common/mail/service/mail.service';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

// Define the document type for TypeScript
export type ReminderDocument = HydratedDocument<Reminder>;

// Main schema
@Schema({ timestamps: true })
export class Reminder extends Document {
  @Prop({ type: String, required: true })
  from: string;

  @Prop({ type: String, required: true })
  to: string;

  @Prop({ type: String, required: true })
  subject: string;

  @Prop({ type: String, required: true, enum: MAIL_TEMPLATES })
  template: MAIL_TEMPLATES;

  @Prop({ type: Object, required: true, default: {} })
  context: any;

  @Prop({
    type: String,
    default: 'sent',
    enum: ['sent', 'failed'],
  })
  status: string;

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