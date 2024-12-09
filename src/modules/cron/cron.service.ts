import { LoggerService } from '@/common/logger/services/logger.service';
import { OrderService } from '@/modules/order/services/order.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReminderService } from '../reminder/services/reminder.service';

@Injectable()
export class TasksService {
  constructor(
    private loggerService: LoggerService,
    private orderService: OrderService,
    private reminderService: ReminderService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async updateAMCPayments() {
    try {
      this.loggerService.log('Starting daily AMC payment update cron job');
      await this.orderService.updateAMCPayments();
      this.loggerService.log(
        'Successfully completed AMC payment update cron job',
      );
    } catch (error: any) {
      this.loggerService.error(
        'Error in AMC payment update cron job',
        JSON.stringify(error),
      );
    }
  }

  @Cron(CronExpression.EVERY_5_HOURS)
  async sendpendingAMCReminders() {
    try {
      this.loggerService.log('Starting daily AMC reminder cron job');
      await this.reminderService.checkAMCPendingPaymentsAndSendReminder();
      this.loggerService.log('Successfully completed AMC reminder cron job');
    } catch (error: any) {
      this.loggerService.error(
        'Error in AMC reminder cron job',
        JSON.stringify(error),
      );
    }
  }

  @Cron(CronExpression.EVERY_4_HOURS)
  async sendUpcomingAMCReminders() {
    try {
      this.loggerService.log('Starting daily AMC reminder cron job');
      await this.reminderService.checkAMCUpcomingPaymentsAndSendReminder();
      this.loggerService.log('Successfully completed AMC reminder cron job');
    } catch (error: any) {
      this.loggerService.error(
        'Error in AMC reminder cron job',
        JSON.stringify(error),
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async sentAgreementExpiryReminders() {
    try {
      this.loggerService.log(
        'Starting daily agreement expiry reminder cron job',
      );
      await this.reminderService.checkAgreementExpiryAndSendReminder();
      this.loggerService.log(
        'Successfully completed agreement expiry reminder cron job',
      );
    } catch (error: any) {
      console.log(error);
      this.loggerService.error(
        'Error in agreement expiry reminder cron job',
        JSON.stringify(error),
      );
    }
  }
}
