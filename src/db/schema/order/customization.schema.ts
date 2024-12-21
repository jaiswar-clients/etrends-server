import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document,
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

export type CustomizationDocument = HydratedDocument<Customization>;

export enum CustomizationType {
  MODULE = 'module',
  REPORT = 'report',
  CUSTOMIZATION = 'customization',
}

@Schema({ timestamps: true })
export class Customization extends Document {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Product' })
  product_id: Types.ObjectId; // Product for which Id purchases

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  order_id: Types.ObjectId;

  @Prop({ type: Number })
  cost: number;

  @Prop({ type: [String] })
  modules: string[];

  @Prop({ type: [String] })
  reports: string[];

  @Prop({ type: String })
  title: string;

  @Prop({ type: String, enum: CustomizationType })
  type: CustomizationType;

  @Prop({ type: Date })
  purchased_date: Date;

  @Prop({ type: String })
  purchase_order_document: string; // cdn url

  @Prop({ type: String })
  invoice_document: string; // cdn url

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

// Define schema with plugins and virtuals as needed
const CustomizationSchema = SchemaFactory.createForClass(Customization);
CustomizationSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
CustomizationSchema.set('toObject', { virtuals: true });
CustomizationSchema.set('toJSON', { virtuals: true });

export { CustomizationSchema };
