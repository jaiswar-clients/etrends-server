import { Product, ProductDocument } from '@/db/schema/product.schema';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { LoggerService } from '@/common/logger/services/logger.service';
import { CreateProductDto } from '../dto/create-product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private productModel: SoftDeleteModel<ProductDocument>,
    private loggerService: LoggerService,
  ) {}

  //   add route to get all products with logs
  async getAllProducts() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getAllProducts: Fetching Products info ',
        }),
      );

      const products = await this.productModel.find();

      this.loggerService.warn(
        JSON.stringify({
          message: 'getAllProducts: Products Fetched',
          products,
        }),
      );

      return products.map((product) => product.toObject());
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getAllProducts: Failed to get products',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message ?? 'Server failed',
        HttpStatus.BAD_GATEWAY,
        {
          cause: error,
        },
      );
    }
  }

  async createProduct(body: CreateProductDto) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'createProduct: Creating Product',
          body,
        }),
      );

      const product = await this.productModel.create(body);

      this.loggerService.log(
        JSON.stringify({
          message: 'createProduct: Product Created',
          product,
        }),
      );

      return product.toObject();
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'createProduct: Failed to create product',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message ?? 'Server failed',
        HttpStatus.BAD_GATEWAY,
        {
          cause: error,
        },
      );
    }
  }

  async deleteProductById(id: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'deleteProductById: Deleting Product',
          id,
        }),
      );

      const product = await this.productModel.findByIdAndDelete(id);

      this.loggerService.warn(
        JSON.stringify({
          message: 'deleteProductById: Product Deleted',
          product,
        }),
      );

      return 'deleted';
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'deleteProductById: Failed to delete product',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message ?? 'Server failed',
        HttpStatus.BAD_GATEWAY,
        {
          cause: error,
        },
      );
    }
  }

  async getProductById(id: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getProductById: Fetching Product info ',
          id,
        }),
      );

      const product = await this.productModel.findById(id);

      this.loggerService.warn(
        JSON.stringify({
          message: 'getProductById: Product Fetched',
          product,
        }),
      );

      return product?.toObject();
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getProductById: Failed to get product',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message ?? 'Server failed',
        HttpStatus.BAD_GATEWAY,
        {
          cause: error,
        },
      );
    }
  }

  async updateProductById(id: string, body: CreateProductDto) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'updateProductById: Updating Product',
          id,
          body,
        }),
      );

      const product = await this.productModel.findByIdAndUpdate(id, body, {
        new: true,
      });

      this.loggerService.warn(
        JSON.stringify({
          message: 'updateProductById: Product Updated',
          product,
        }),
      );

      return product?.toObject();
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'updateProductById: Failed to update product',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message ?? 'Server failed',
        HttpStatus.BAD_GATEWAY,
        {
          cause: error,
        },
      );
    }
  }
}
