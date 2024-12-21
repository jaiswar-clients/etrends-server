import { Document, HydratedDocument } from 'mongoose';
export type UserDocument = HydratedDocument<User>;
export declare class User extends Document {
    name: string;
    email: string;
    img: string;
    designation: string;
    password: string;
}
declare const UserSchema: import("mongoose").Schema<User, import("mongoose").Model<User, any, any, any, Document<unknown, any, User> & User & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, User, Document<unknown, {}, import("mongoose").FlatRecord<User>> & import("mongoose").FlatRecord<User> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export { UserSchema };
