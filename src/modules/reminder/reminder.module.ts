import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
import { Reminder, ReminderSchema } from '@/db/schema/reminder.schema';
import { ReminderController } from './controller/reminder.controller';
import { ReminderService } from './services/reminder.service';

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
      { name: Reminder.name, schema: ReminderSchema },
    ]),
  ],
  controllers: [ReminderController],
  providers: [ReminderService, MailService],
  exports: [ReminderService],
})
export class ReminderModule implements OnModuleInit {
  constructor(private reminderService: ReminderService) {}

  async onModuleInit() {
    // await this.reminderService.checkAMCPendingPaymentsAndSendReminder();
  }
}
