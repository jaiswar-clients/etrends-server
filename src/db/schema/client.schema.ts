import { INDUSTRIES_ENUM } from '@/common/types/enums/industry.enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

export type ClientDocument = HydratedDocument<Client>;

class PointOfContact {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String })
  designation: string;

  @Prop({ type: String })
  phone: string;

  @Prop({ type: Boolean, default: false })
  opt_for_email_reminder: boolean;
}

@Schema({ timestamps: true })
export class Client extends Document {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String })
  parent_company: string;

  @Prop({ type: String })
  pan_number: string;

  @Prop({ type: String })
  gst_number: string;

  @Prop({ type: String })
  address: string;

  @Prop({ type: String, enum: INDUSTRIES_ENUM })
  industry: string;

  @Prop({ type: String })
  client_id: string;

  @Prop({ type: String })
  vendor_id: string;

  @Prop({ type: [PointOfContact], default: [] })
  point_of_contacts: PointOfContact[];

  @Prop({ type: [String], default: [] })
  orders: [];
}

const ClientSchema = SchemaFactory.createForClass(Client);
ClientSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});

ClientSchema.set('toObject', { virtuals: true });
ClientSchema.set('toJSON', { virtuals: true });

export { ClientSchema };
