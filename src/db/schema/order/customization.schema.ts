import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document,
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { IAMCRate } from './order.schema';

export type CustomizationDocument = HydratedDocument<Customization>;

@Schema({ timestamps: true })
export class Customization extends Document {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Product' })
  product_id: Types.ObjectId; // Product for which Id purchases

  @Prop({ type: String })
  cost: String;

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

  @Prop({ type: String })
  modules: string[];

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
