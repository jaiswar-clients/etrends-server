import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
export type EntityDocument = HydratedDocument<Entity>;
export declare class Entity extends Document {
    name: string;
    createdAt?: Date;
    updatedAt?: Date;
}
declare const EntitySchema: MongooseSchema<Entity, import("mongoose").Model<Entity, any, any, any, Document<unknown, any, Entity> & Entity & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Entity, Document<unknown, {}, import("mongoose").FlatRecord<Entity>> & import("mongoose").FlatRecord<Entity> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export { EntitySchema };
