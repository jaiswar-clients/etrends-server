import { Module, OnModuleInit } from '@nestjs/common';
import { OrderController } from './controller/order.controller';
import { OrderService } from './services/order.service';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageModule } from '@/common/storage/storage.module';
import {
  Customization,
  CustomizationSchema,
} from '@/db/schema/order/customization.schema';
import {
  AdditionalService,
  AdditionalServiceSchema,
} from '@/db/schema/order/additional-service.schema';
import { Order, OrderSchema } from '@/db/schema/order/product-order.schema';
import { License, LicenseSchema } from '@/db/schema/order/license.schema';
import { Product, ProductSchema } from '@/db/schema/product.schema';
import { Client, ClientSchema } from '@/db/schema/client.schema';
import { AMC, AMCSchema } from '@/db/schema/amc/amc.schema';
import { MailService } from '@/common/mail/service/mail.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: License.name, schema: LicenseSchema },
      { name: Customization.name, schema: CustomizationSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Client.name, schema: ClientSchema },
      { name: AdditionalService.name, schema: AdditionalServiceSchema },
      { name: AMC.name, schema: AMCSchema },
    ]),
    StorageModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, MailService],
  exports: [OrderService],
})
export class OrderModule implements OnModuleInit {
  constructor(private orderService: OrderService) {}

  async onModuleInit() {
    // const data = await this.orderService.getAllPendingPayments();
    // console.log(data);  
  }
}
