import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
export type ProductDocument = HydratedDocument<Product>;
export declare class Product extends Document {
    name: string;
    short_name: string;
    does_have_license: boolean;
    description: string;
    modules: {
        name: string;
        key: string;
        description: string;
    }[];
    reports: {
        name: string;
        key: string;
        description: string;
    }[];
}
declare const ProductSchema: MongooseSchema<Product, import("mongoose").Model<Product, any, any, any, Document<unknown, any, Product> & Product & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Product, Document<unknown, {}, import("mongoose").FlatRecord<Product>> & import("mongoose").FlatRecord<Product> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export { ProductSchema };
