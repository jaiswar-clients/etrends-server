import { LoggerService } from '@/common/logger/services/logger.service';
import { OrderService } from '@/modules/order/services/order.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReminderService } from '../reminder/services/reminder.service';
import { BackupService } from '../backup/backup.service';

@Injectable()
export class TasksService {
  constructor(
    private loggerService: LoggerService,
    private orderService: OrderService,
    private reminderService: ReminderService,
    private backupService: BackupService,
  ) {}

  @Cron(CronExpression.EVERY_2_HOURS)
  async updateAMCPayments() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'updateAMCPayments: Starting daily AMC payment update cron job',
        }),
      );
      await this.orderService.updateAMCPayments();
      this.loggerService.log(
        JSON.stringify({
          message: 'updateAMCPayments: Successfully completed AMC payment update cron job',
        }),
      );
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'updateAMCPayments: Error in AMC payment update cron job',
          error: error.message,
        }),
      );
    }
  }

  @Cron(CronExpression.EVERY_5_HOURS)
  async sendpendingAMCReminders() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'sendpendingAMCReminders: Starting daily AMC reminder cron job',
        }),
      );
      await this.reminderService.checkAMCPendingPaymentsAndSendReminder();
      this.loggerService.log(
        JSON.stringify({
          message: 'sendpendingAMCReminders: Successfully completed AMC reminder cron job',
        }),
      );
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'sendpendingAMCReminders: Error in AMC reminder cron job',
          error: error.message,
        }),
      );
    }
  }

  @Cron(CronExpression.EVERY_4_HOURS)
  async sendUpcomingAMCReminders() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'sendUpcomingAMCReminders: Starting daily AMC reminder cron job',
        }),
      );
      await this.reminderService.checkAMCUpcomingPaymentsAndSendReminder();
      this.loggerService.log(
        JSON.stringify({
          message: 'sendUpcomingAMCReminders: Successfully completed AMC reminder cron job',
        }),
      );
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'sendUpcomingAMCReminders: Error in AMC reminder cron job',
          error: error.message,
        }),
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async sentAgreementExpiryReminders() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'sentAgreementExpiryReminders: Starting daily agreement expiry reminder cron job',
        }),
      );
      await this.reminderService.checkAgreementExpiryAndSendReminder();
      this.loggerService.log(
        JSON.stringify({
          message: 'sentAgreementExpiryReminders: Successfully completed agreement expiry reminder cron job',
        }),
      );
    } catch (error: any) {
      console.log(error);
      this.loggerService.error(
        JSON.stringify({
          message: 'sentAgreementExpiryReminders: Error in agreement expiry reminder cron job',
          error: error.message,
        }),
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1PM)
  async createDatabaseBackup() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'createDatabaseBackup: Starting daily database backup cron job',
        }),
      );
      
      const backupDir = await this.backupService.createBackup();
      
      this.loggerService.log(
        JSON.stringify({
          message: 'createDatabaseBackup: Successfully completed database backup cron job',
          backupDirectory: backupDir,
        }),
      );
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'createDatabaseBackup: Error in database backup cron job',
          error: error.message,
        }),
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldBackups() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'cleanupOldBackups: Starting cleanup of old backups cron job',
        }),
      );
      
      await this.backupService.cleanupOldBackups(90); // Keep backups for 90 days
      
      this.loggerService.log(
        JSON.stringify({
          message: 'cleanupOldBackups: Successfully completed cleanup of old backups cron job',
        }),
      );
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'cleanupOldBackups: Error in cleanup of old backups cron job',
          error: error.message,
        }),
      );
    }
  }
}
