import { OnModuleInit } from '@nestjs/common';
import { OrderService } from './services/order.service';
export declare class OrderModule implements OnModuleInit {
    private orderService;
    constructor(orderService: OrderService);
    onModuleInit(): Promise<void>;
}
