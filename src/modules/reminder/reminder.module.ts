import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '@/db/schema/order/product-order.schema';
import { AMC, AMCSchema } from '@/db/schema/amc/amc.schema';
import { MailService } from '@/common/mail/service/mail.service';
import {
  Reminder,
  ReminderSchema,
} from '@/db/schema/reminders/reminder.schema';
import { ReminderController } from './controller/reminder.controller';
import { ReminderService } from './services/reminder.service';
import { StorageModule } from '@/common/storage/storage.module';
import {
  EmailTemplate,
  EmailTemplateSchema,
} from '@/db/schema/reminders/email.template.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: AMC.name, schema: AMCSchema },
      { name: Reminder.name, schema: ReminderSchema },
      {
        name: EmailTemplate.name,
        schema: EmailTemplateSchema,
      },
    ]),
    StorageModule,
  ],
  controllers: [ReminderController],
  providers: [ReminderService, MailService],
  exports: [ReminderService],
})
export class ReminderModule implements OnModuleInit {
  constructor(private reminderService: ReminderService) {}

  async onModuleInit() {
    // await this.reminderService.checkAgreementExpiryAndSendReminder();
  }
}
