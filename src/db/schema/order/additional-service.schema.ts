import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongooseDelete from 'mongoose-delete';

import {
  Document,
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';
import { Type } from 'class-transformer';

// Define the document type for TypeScript
export type AdditionalServiceDocument = HydratedDocument<AdditionalService>;

// Main schema
@Schema({ timestamps: true })
export class AdditionalService extends Document {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Product' })
  product_id: Types.ObjectId; // Product for which Id purchases

  @Prop({ type: String, required: true })
  name: string;

  @Prop({
    type: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },
  })
  date: {
    start: Date;
    end: Date;
  };

  @Prop({ type: Number, required: true })
  cost: number;

  @Prop({ type: String })
  purchase_order_document: string; // cdn url

  @Prop({ type: String })
  invoice_document: string; // cdn url

  @Prop({ type: String })
  service_document: string; // cdn url

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  order_id: Types.ObjectId;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

// Define schema with plugins and virtuals as needed
const AdditionalServiceSchema = SchemaFactory.createForClass(AdditionalService);
AdditionalServiceSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
AdditionalServiceSchema.set('toObject', { virtuals: true });
AdditionalServiceSchema.set('toJSON', { virtuals: true });

export { AdditionalServiceSchema };
