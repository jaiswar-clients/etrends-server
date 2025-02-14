import { OrderDocument } from '@/db/schema/order/product-order.schema';
import { SoftDeleteModel } from 'mongoose-delete';
import { LoggerService } from '@/common/logger/services/logger.service';
import { AMCDocument } from '@/db/schema/amc/amc.schema';
import { MAIL_TEMPLATES, MailService } from '@/common/mail/service/mail.service';
import { Reminder, ReminderDocument } from '@/db/schema/reminders/reminder.schema';
import { ConfigService } from '@/common/config/services/config.service';
import { SendEmailDto } from '../dto/send-email';
import { StorageService } from '@/common/storage/services/storage.service';
import { EmailTemplate, EmailTemplateDocument } from '@/db/schema/reminders/email.template.schema';
export declare class ReminderService {
    private orderModel;
    private amcModel;
    private reminderModel;
    private emailTemplateModel;
    private loggerService;
    private mailService;
    private configService;
    private storageService;
    private INTERNAL_TEAM_EMAIL;
    constructor(orderModel: SoftDeleteModel<OrderDocument>, amcModel: SoftDeleteModel<AMCDocument>, reminderModel: SoftDeleteModel<ReminderDocument>, emailTemplateModel: SoftDeleteModel<EmailTemplateDocument>, loggerService: LoggerService, mailService: MailService, configService: ConfigService, storageService: StorageService);
    sendTestEmail(): Promise<string>;
    checkAMCPendingPaymentsAndSendReminder(): Promise<void>;
    sendReminderEmail1(email: string, subject: string, template: MAIL_TEMPLATES, context: any): Promise<string>;
    private updateReminder;
    private fetchPendingAMCs;
    private shouldSkipReminder;
    private getOverdueAMCDetails;
    private getUniqueProducts;
    checkAMCUpcomingPaymentsAndSendReminder(): Promise<void>;
    getUpcomingAMCDetails(amcs: AMCDocument[], nextMonth: Date): Promise<{
        cycle: string;
        amount: string;
        date: string;
        upcoming: number;
        link: string;
        updateLink: string;
    }[]>;
    checkAgreementExpiryAndSendReminder(): Promise<void>;
    private getExpiringAgreementDetails;
    getAllInternalReminders(): Promise<any[]>;
    getReminderById(id: string): Promise<import("mongoose").Document<unknown, {}, Reminder> & Reminder & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    sendEmailToClient(data: SendEmailDto): Promise<string>;
    getEmailTemplates(): Promise<(import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, EmailTemplate> & EmailTemplate & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, EmailTemplate> & EmailTemplate & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    getExternalCommunicationHistory(): Promise<(import("mongoose").Document<unknown, {}, Reminder> & Reminder & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
}
