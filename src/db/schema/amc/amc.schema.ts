import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

// Define the document type for TypeScript
export type AMCDocument = HydratedDocument<AMC>;

export enum PAYMENT_STATUS_ENUM {
  PAID = 'paid',
  PENDING = 'pending',
  PARTIAL = 'partial',
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

  @Prop({ type: String })
  purchase_order_number: string;

  @Prop({ type: Date })
  start_date: Date;

  @Prop({
    type: [
      {
        from_date: { type: Date, required: true },
        to_date: { type: Date, required: true },
        status: {
          type: String,
          enum: Object.values(PAYMENT_STATUS_ENUM),
          required: true,
        },
      },
    ],
  })
  payments: {
    _id: any;
    from_date: Date;
    to_date: Date;
    status: PAYMENT_STATUS_ENUM; // AMC is free for 1 year that's status will be paid
  }[];

  @Prop({ type: String })
  purchase_order_document: string;

  @Prop({ type: String })
  invoice_document: string;

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
