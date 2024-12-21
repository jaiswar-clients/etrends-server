import { LoggerService } from '@/common/logger/services/logger.service';
import { OrderService } from '@/modules/order/services/order.service';
import { ReminderService } from '../reminder/services/reminder.service';
export declare class TasksService {
    private loggerService;
    private orderService;
    private reminderService;
    constructor(loggerService: LoggerService, orderService: OrderService, reminderService: ReminderService);
    updateAMCPayments(): Promise<void>;
    sendpendingAMCReminders(): Promise<void>;
    sendUpcomingAMCReminders(): Promise<void>;
    sentAgreementExpiryReminders(): Promise<void>;
}
