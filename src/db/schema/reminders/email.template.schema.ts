import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

// Define the interface for dynamic variables
interface DynamicVariable {
  _id: MongooseSchema.Types.ObjectId;
  key: string;
  field: string;
}

// Define the document type for TypeScript
export type EmailTemplateDocument = HydratedDocument<EmailTemplate>;

// Main schema
@Schema({ timestamps: true })
export class EmailTemplate extends Document {
  @Prop({ type: String, required: true })
  key: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  content: string;

  @Prop({
    type: [
      {
        _id: { type: MongooseSchema.Types.ObjectId, auto: true },
        key: String,
        field: String,
      },
    ],
    required: true,
  })
  dynamic_variables: DynamicVariable[];

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

// Define schema with plugins and virtuals as needed
const EmailTemplateSchema = SchemaFactory.createForClass(EmailTemplate);
EmailTemplateSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
EmailTemplateSchema.set('toObject', { virtuals: true });
EmailTemplateSchema.set('toJSON', { virtuals: true });

export { EmailTemplateSchema };
