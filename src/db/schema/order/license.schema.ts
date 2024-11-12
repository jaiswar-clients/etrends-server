import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document,
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

// Define the document type for TypeScript
export type LicenseDocument = HydratedDocument<License>;

// Main schema
@Schema({ timestamps: true })
export class License extends Document {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Product' })
  product_id: Types.ObjectId; // Product for which Id purchases

  @Prop({ type: String })
  training_implementation_cost: string;

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
  rate: {
    percentage: number;
    amount: number;
  };

  @Prop({ type: Number })
  total_license: number;

  @Prop({ type: Date })
  purchase_date: Date;

  @Prop({ type: String })
  purchase_order_document: string; // cdn url

  @Prop({ type: String })
  invoice: string; // cdn url

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
