import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { OrderService } from '../services/order.service';
import { CreateOrderDto } from '../dto/create-first-order.dto';
import { CreateNewOrderDto } from '../dto/create-order.dto';

export type UpdateFirstOrderType = CreateOrderDto;

@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Get('/first/:id')
  async getFirstOrder(@Param('id') clientId: string) {
    return this.orderService.getFirstOrder(clientId);
  }

  @Post('/first/:clientId')
  async createFirstOrder(
    @Param('clientId') clientId: string,
    @Body() body: CreateOrderDto,
  ) {
    return this.orderService.createFirstOrder(clientId, body);
  }

  @Patch('/first/:id')
  async updateFirstOrder(
    @Param('id') id: string,
    @Body() body: UpdateFirstOrderType,
  ) {
    return this.orderService.updateFirstOrder(id, body);
  }

  @Post('/:clientId')
  async createOrder(
    @Param('clientId') clientId: string,
    @Body() body: CreateNewOrderDto,
  ) {
    return this.orderService.createNewOrder(clientId, body);
  }
}
