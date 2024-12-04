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

class PaymentTerms {
  @Prop({ type: String })
  name: string;

  @Prop({ type: String })
  percentage_from_base_cost: number;

  @Prop({ type: Number })
  calculated_amount: number;

  @Prop({ type: Date })
  date: Date;
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

  @Prop({ type: String })
  training_implementation_cost: string;

  @Prop({ type: Types.ObjectId, ref: 'Client' })
  client_id: Types.ObjectId;

  @Prop({ type: Number })
  base_cost: number;

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

  @Prop({ type: [PaymentTerms] })
  payment_terms: PaymentTerms[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'License' }] })
  licenses: Types.ObjectId[]; // array of license IDs

  @Prop({ type: String })
  agreement_document: string; // file url

  @Prop({
    type: {
      start: Date,
      end: Date,
    },
  })
  agreement_date: {
    start: Date;
    end: Date;
  };

  @Prop({ type: String })
  purchase_order_document: string; // cdn url

  @Prop({ type: Date, default: Date.now })
  purchased_date: Date;

  @Prop({
    type: {
      title: String,
      url: String,
    },
    default: {},
  })
  other_document: {
    title: string;
    url: string;
  }; // cdn url

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Customization' }] })
  customizations: Types.ObjectId[]; // array of customization IDs

  @Prop({ type: Types.ObjectId, ref: 'AdditionalService' })
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
