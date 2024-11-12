import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

// Define the document type for TypeScript
export type EntityDocument = HydratedDocument<Entity>;

// Main schema
@Schema({ timestamps: true })
export class Entity extends Document {
  @Prop({ type: String, required: true })
  name: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

// Define schema with plugins and virtuals as needed
const EntitySchema = SchemaFactory.createForClass(Entity);
EntitySchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
EntitySchema.set('toObject', { virtuals: true });
EntitySchema.set('toJSON', { virtuals: true });

export { EntitySchema };
