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
  percentage_from_base_cost: string;

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

  @Prop({ type: Number })
  base_cost: number;

  @Prop({
    type: {
      percentage: {
        type: Number,
        max: 100,
        default: 20,
      },
      amount: String,
    },
  })
  amc_rate: IAMCRate;

  @Prop({ type: String, enum: ORDER_STATUS_ENUM })
  status: ORDER_STATUS_ENUM;

  @Prop({ type: [PaymentTerms] })
  payment_terms: PaymentTerms[];

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
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
