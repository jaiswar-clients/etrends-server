import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

// Define the document type for TypeScript
export type AMCDocument = HydratedDocument<AMC>;

export enum PAYMENT_STATUS_ENUM {
  PENDING = 'pending',
  proforma = 'proforma',
  INVOICE = 'invoice',
  PAID = 'paid',
}

export interface IAMCPayment {
  _id?: any;
  from_date: Date;
  to_date: Date;
  status: PAYMENT_STATUS_ENUM; // AMC is free for 1 year that's status will be paid
  received_date?: Date;
  amc_rate_applied?: number;
  amc_rate_amount?: number;
  total_cost?: number;
  purchase_order_number?: string;
  purchase_order_document?: string;
  purchase_order_date?: Date;
  proforma_date?: Date;
  invoice_document?: string;
  invoice_number?: string;
  invoice_date?: Date;
}

// Main schema
@Schema({ timestamps: true })
export class AMC extends Document {
  @Prop({ required: true, ref: 'Order', type: MongooseSchema.Types.ObjectId })
  order_id: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, ref: 'Client', type: MongooseSchema.Types.ObjectId })
  client_id: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, type: Number })
  total_cost: number;

  // @Prop({ type: Date })
  // start_date: Date;

  @Prop({
    type: [
      {
        from_date: { type: Date },
        to_date: { type: Date },
        status: {
          type: String,
          enum: Object.values(PAYMENT_STATUS_ENUM),
        },
        amc_rate_applied: { type: Number },
        amc_rate_amount: { type: Number },
        total_cost: { type: Number },
        received_date: { type: Date },
        purchase_order_number: String,
        purchase_order_document: String,
        purchase_order_date: { type: Date },
        proforma_date: { type: Date },
        invoice_document: String,
        invoice_number: String,
        invoice_date: { type: Date },
      },
    ],
  })
  payments: IAMCPayment[];

  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({ type: Number })
  amc_percentage: number;

  @Prop({
    type: [
      {
        type: MongooseSchema.Types.ObjectId,
        ref: 'Product',
      },
    ],
  })
  products: MongooseSchema.Types.ObjectId[];

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

// Define schema with plugins and virtuals as needed
const AMCSchema = SchemaFactory.createForClass(AMC);
AMCSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
AMCSchema.set('toObject', { virtuals: true });
AMCSchema.set('toJSON', { virtuals: true });

export { AMCSchema };
