import { Module } from '@nestjs/common';
import { OrderController } from './controller/order.controller';
import { OrderService } from './services/order.service';

@Module({
  controllers: [OrderController],
  providers: [OrderService]
})
export class OrderModule {}
