import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from '../services/product.service';
import { AuthGuard } from '@/common/guards/auth.guard';
import { CreateProductDto } from '../dto/create-product.dto';

@Controller('products')
@UseGuards(AuthGuard)
export class ProductController {
  constructor(private productService: ProductService) {}

  @Get()
  async getAllProducts() {
    return this.productService.getAllProducts();
  }

  @Post()
  async createProduct(@Body() body: CreateProductDto) {
    return this.productService.createProduct(body);
  }

  @Delete('/:id')
  async deleteProduct(@Param('id') id: string) {
    return this.productService.deleteProductById(id);
  }
}
