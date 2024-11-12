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
  does_have_license: Boolean;

  @Prop({ type: String, required: true })
  description: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
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
