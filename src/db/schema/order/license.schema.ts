import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document,
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { PAYMENT_STATUS_ENUM } from './product-order.schema';

// Define the document type for TypeScript
export type LicenseDocument = HydratedDocument<License>;

// Main schema
@Schema({ timestamps: true })
export class License extends Document {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Product' })
  product_id: Types.ObjectId; // Product for which Id purchases

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  order_id: Types.ObjectId;

  @Prop({
    type: {
      percentage: {
        type: Number,
        max: 100,
        default: 20,
      },
      amount: Number,
    },
  })
  rate: {
    percentage: number;
    amount: number;
  };

  @Prop({
    type: String,
    enum: PAYMENT_STATUS_ENUM,
    default: PAYMENT_STATUS_ENUM.PENDING,
  })
  payment_status: PAYMENT_STATUS_ENUM;

  @Prop({ type: Date })
  payment_receive_date: Date;

  @Prop({ type: Number })
  total_license: number;

  @Prop({ type: Date })
  purchase_date: Date;

  @Prop({ type: String })
  purchase_order_document: string; // cdn url

  @Prop({ type: String })
  purchase_order_number: string;

  @Prop({ type: String })
  invoice_number: string;

  @Prop({ type: Date })
  invoice_date: Date;

  @Prop({ type: String })
  invoice_document: string; // cdn url

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

// Define schema with plugins and virtuals as needed
const LicenseSchema = SchemaFactory.createForClass(License);
LicenseSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
LicenseSchema.set('toObject', { virtuals: true });
LicenseSchema.set('toJSON', { virtuals: true });

export { LicenseSchema };
