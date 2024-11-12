import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document,
  HydratedDocument,
  Schema as MongooseSchema,
  Model,
} from 'mongoose';

export type UserDocument = HydratedDocument<User>;
import * as mongooseDelete from 'mongoose-delete';

@Schema()
export class User extends Document {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({
    type: String,
    required: true,
    validate: {
      validator: function (v: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: (props) => `${props.value} is not a valid email!`,
    },
  })
  email: string;

  @Prop({ type: String })
  img: string;

  @Prop({ type: String })
  designation: string;

  @Prop({ type: String })
  password: string;
}

const UserSchema = SchemaFactory.createForClass(User);
UserSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });

UserSchema.set('toObject', { virtuals: true });
UserSchema.set('toJSON', { virtuals: true });

export { UserSchema };
