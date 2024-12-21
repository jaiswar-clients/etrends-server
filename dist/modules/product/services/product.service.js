"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = void 0;
const product_schema_1 = require("../../../db/schema/product.schema");
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const logger_service_1 = require("../../../common/logger/services/logger.service");
let ProductService = class ProductService {
    constructor(productModel, loggerService) {
        this.productModel = productModel;
        this.loggerService = loggerService;
    }
    async getAllProducts() {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getAllProducts: Fetching Products info ',
            }));
            const products = await this.productModel.find();
            this.loggerService.warn(JSON.stringify({
                message: 'getAllProducts: Products Fetched',
                products,
            }));
            return products.map((product) => product.toObject());
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getAllProducts: Failed to get products',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message ?? 'Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
    async createProduct(body) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'createProduct: Creating Product',
                body,
            }));
            const product = await this.productModel.create(body);
            this.loggerService.log(JSON.stringify({
                message: 'createProduct: Product Created',
                product,
            }));
            return product.toObject();
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'createProduct: Failed to create product',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message ?? 'Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
    async deleteProductById(id) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'deleteProductById: Deleting Product',
                id,
            }));
            const product = await this.productModel.findByIdAndDelete(id);
            this.loggerService.warn(JSON.stringify({
                message: 'deleteProductById: Product Deleted',
                product,
            }));
            return 'deleted';
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'deleteProductById: Failed to delete product',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message ?? 'Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
    async getProductById(id) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getProductById: Fetching Product info ',
                id,
            }));
            const product = await this.productModel.findById(id);
            this.loggerService.warn(JSON.stringify({
                message: 'getProductById: Product Fetched',
                product,
            }));
            return product?.toObject();
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getProductById: Failed to get product',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message ?? 'Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
    async updateProductById(id, body) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'updateProductById: Updating Product',
                id,
                body,
            }));
            const product = await this.productModel.findByIdAndUpdate(id, body, {
                new: true,
            });
            this.loggerService.warn(JSON.stringify({
                message: 'updateProductById: Product Updated',
                product,
            }));
            return product?.toObject();
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'updateProductById: Failed to update product',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message ?? 'Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
};
exports.ProductService = ProductService;
exports.ProductService = ProductService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __metadata("design:paramtypes", [Object, logger_service_1.LoggerService])
], ProductService);
//# sourceMappingURL=product.service.js.map