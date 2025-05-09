import { ORDER_STATUS_ENUM } from '@/common/types/enums/order.enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document,
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

// Define the document type for TypeScript
export type OrderDocument = HydratedDocument<Order>;

export interface IAMCRate {
  percentage: number;
  amount: number;
}

export enum PAYMENT_STATUS_ENUM {
  PAID = 'paid',
  PENDING = 'pending',
}

class PaymentTerms {
  @Prop({ type: String })
  name: string;

  @Prop({ type: String })
  percentage_from_base_cost: number;

  @Prop({ type: Number })
  calculated_amount: number;

  @Prop({ type: String })
  invoice_document: string; // cdn url

  @Prop({ type: String })
  invoice_number: string;

  @Prop({ type: Date })
  invoice_date: Date;

  @Prop({
    type: String,
    enum: PAYMENT_STATUS_ENUM,
    default: PAYMENT_STATUS_ENUM.PENDING,
  })
  status: PAYMENT_STATUS_ENUM;

  @Prop({ type: Date })
  payment_receive_date: Date;
}

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({
    type: [
      {
        type: Types.ObjectId,
        ref: 'Product',
      },
    ],
    required: true,
  })
  products: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Client' })
  client_id: Types.ObjectId;

  @Prop({ type: Number })
  base_cost: number;

  @Prop({
    type: [
      {
        product_id: { type: Types.ObjectId, ref: 'Product' },
        amount: Number,
        percentage: Number,
      },
    ],
    default: {},
  })
  base_cost_seperation: {
    product_id: Types.ObjectId;
    amount: number;
    percentage: number;
  }[];

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
  amc_rate: IAMCRate;

  @Prop({ type: Types.ObjectId, ref: 'AMC' })
  amc_id: Types.ObjectId;

  @Prop({ type: String, enum: ORDER_STATUS_ENUM })
  status: ORDER_STATUS_ENUM;

  @Prop({ type: Number, default: 0 })
  licenses_with_base_price: number;

  @Prop({ type: Number, default: 0 })
  cost_per_license: number;

  @Prop({ type: [PaymentTerms] })
  payment_terms: PaymentTerms[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'License' }] })
  licenses: Types.ObjectId[]; // array of license IDs

  @Prop({ type: Number, default: 0 })
  training_and_implementation_cost: number;

  @Prop({
    type: [
      {
        start: Date,
        end: Date,
        document: String,
      },
    ],
    default: [],
  })
  agreements: {
    _id: any;
    start: Date;
    end: Date;
    document: string;
  }[];

  @Prop({ type: String })
  purchase_order_document: string; // cdn url

  @Prop({ type: String })
  purchase_order_number: string;

  @Prop({ type: Date, default: Date.now })
  purchased_date: Date;

  @Prop({
    type: [
      {
        title: String,
        url: String,
      },
    ],
    default: {},
  })
  other_documents: {
    title: string;
    url: string;
  }[]; // cdn url

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Customization' }] })
  customizations: Types.ObjectId[]; // array of customization IDs

  @Prop({ type: Number, default: 0 })
  amc_rate_change_frequency_in_years: number; // Number of years after which AMC rate changes

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Additional' }] })
  additional_services: Types.ObjectId[]; // array of additional service IDs

  @Prop({ type: Date })
  amc_start_date: Date; // date of deployment is also the start date of the AMC

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  @Prop({
    type: {
      customization: Boolean,
      license: Boolean,
    },
    default: {
      customization: false,
      license: false,
    },
  })
  is_purchased_with_order: {
    customization: boolean; // if customization is purchased with order than it always the first elemenet of the customizations array
    license: boolean;
  };

  @Prop({
    type: [
      {
        from: String,
        to: String,
        date: Date,
        user: Types.ObjectId,
      },
    ],
    default: [],
  })
  status_logs: {
    from: ORDER_STATUS_ENUM;
    to: ORDER_STATUS_ENUM;
    date: Date;
    user: Types.ObjectId;
  }[];

  @Prop({
    type: [
      {
        percentage: Number,
        amount: Number,
        date: Date,
      },
    ],
    default: [],
  })
  amc_rate_history: {
    percentage: number;
    amount: number;
    date: Date;
  }[];
}

// Define schema with plugins and virtuals as needed
const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
OrderSchema.set('toObject', { virtuals: true });
OrderSchema.set('toJSON', { virtuals: true });

export { OrderSchema };
