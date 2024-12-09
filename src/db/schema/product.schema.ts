import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

// Define the document type for TypeScript
export type ProductDocument = HydratedDocument<Product>;

// Main schema
@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  short_name: string;

  @Prop({ type: Boolean, default: false })
  does_have_license: boolean;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({
    type: [
      {
        name: String,
        key: String,
        description: String,
      },
    ],
  })
  modules: { name: string; key: string; description: string }[];

  @Prop({
    type: [
      {
        name: String,
        key: String,
        description: String,
      },
    ],
  })
  reports: { name: string; key: string; description: string }[];
}

// Define schema with plugins and virtuals as needed
const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
ProductSchema.set('toObject', { virtuals: true });
ProductSchema.set('toJSON', { virtuals: true });

export { ProductSchema };
