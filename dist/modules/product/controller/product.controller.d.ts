import { ProductService } from '../services/product.service';
import { CreateProductDto, UpdateProductDto } from '../dto/create-product.dto';
export declare class ProductController {
    private productService;
    constructor(productService: ProductService);
    getAllProducts(): Promise<(import("mongoose").Document<unknown, {}, import("../../../db/schema/product.schema").Product> & import("../../../db/schema/product.schema").Product & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    getProductById(id: string): Promise<import("mongoose").Document<unknown, {}, import("../../../db/schema/product.schema").Product> & import("../../../db/schema/product.schema").Product & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    createProduct(body: CreateProductDto): Promise<import("mongoose").Document<unknown, {}, import("../../../db/schema/product.schema").Product> & import("../../../db/schema/product.schema").Product & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateProduct(id: string, body: UpdateProductDto): Promise<import("mongoose").Document<unknown, {}, import("../../../db/schema/product.schema").Product> & import("../../../db/schema/product.schema").Product & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    deleteProduct(id: string): Promise<string>;
}
