import { INDUSTRIES_ENUM } from '@/common/types/enums/industry.enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';
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

  @Prop({ type: Types.ObjectId, ref: 'Client' })
  parent_company_id: Types.ObjectId;

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

  @Prop({
    required: true,
    type: Number,
    default: 12,
    enum: [1, 3, 6, 12, 18, 24],
  })
  amc_frequency_in_months: number;

  @Prop({ type: String })
  vendor_id: string;

  @Prop({ type: Boolean, default: false })
  is_parent_company: boolean;

  @Prop({
    type: [
      {
        type: Types.ObjectId,
        ref: 'Client',
      },
    ],
    default: [],
  })
  child_companies: Types.ObjectId[];

  @Prop({ type: [PointOfContact], default: [] })
  point_of_contacts: PointOfContact[];

  @Prop({
    type: [
      {
        type: Types.ObjectId,
        ref: 'Order',
      },
    ],
    default: [],
  })
  orders: Types.ObjectId[];

  @Prop({ type: String, default: '' })
  remark: string;

  // add array of amc ids
  @Prop({
    type: [
      {
        type: Types.ObjectId,
        ref: 'AMC',
      },
    ],
    default: [],
  })
  amcs: Types.ObjectId[];
}

const ClientSchema = SchemaFactory.createForClass(Client);
ClientSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});

ClientSchema.set('toObject', { virtuals: true });
ClientSchema.set('toJSON', { virtuals: true });

export { ClientSchema };
