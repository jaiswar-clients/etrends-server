import { Product, ProductDocument } from '@/db/schema/product.schema';
import { SoftDeleteModel } from 'mongoose-delete';
import { LoggerService } from '@/common/logger/services/logger.service';
import { CreateProductDto, UpdateProductDto } from '../dto/create-product.dto';
export declare class ProductService {
    private productModel;
    private loggerService;
    constructor(productModel: SoftDeleteModel<ProductDocument>, loggerService: LoggerService);
    getAllProducts(): Promise<(import("mongoose").Document<unknown, {}, Product> & Product & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    createProduct(body: CreateProductDto): Promise<import("mongoose").Document<unknown, {}, Product> & Product & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    deleteProductById(id: string): Promise<string>;
    getProductById(id: string): Promise<import("mongoose").Document<unknown, {}, Product> & Product & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateProductById(id: string, body: UpdateProductDto): Promise<import("mongoose").Document<unknown, {}, Product> & Product & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
}
