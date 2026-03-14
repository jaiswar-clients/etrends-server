import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

export type FilterPresetDocument = HydratedDocument<FilterPreset>;

@Schema({ timestamps: true })
export class FilterPreset extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  user_id: Types.ObjectId;

  @Prop({ required: true, type: String })
  name: string;

  @Prop({ required: true, type: Object })
  filters: Record<string, any>;

  @Prop({ default: false, type: Boolean })
  isDefault: boolean;
}

const FilterPresetSchema = SchemaFactory.createForClass(FilterPreset);
FilterPresetSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
FilterPresetSchema.set('toObject', { virtuals: true });
FilterPresetSchema.set('toJSON', { virtuals: true });

export { FilterPresetSchema };
