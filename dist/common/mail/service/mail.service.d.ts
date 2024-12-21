import { MailerService } from '@nestjs-modules/mailer';
import { LoggerService } from '@/common/logger/services/logger.service';
export declare enum MAIL_TEMPLATES {
    SEND_UPCOMING_AMC_REMINDER = "amc-upcoming-reminder",
    SEND_PENDING_AMC_REMINDER = "amc-pending-reminder",
    SEND_AGREEMENT_EXPIRY_REMINDER = "agreement-expiry-reminder"
}
export declare class MailService {
    private readonly mailerService;
    private loggerService;
    constructor(mailerService: MailerService, loggerService: LoggerService);
    sendMail({ email, subject, context, template, attachments, }: {
        email: string;
        subject: string;
        template: MAIL_TEMPLATES;
        context: any;
        attachments?: {
            filename: string;
            path: string;
            contentType?: string;
        }[];
    }): Promise<string>;
    sendMailWithoutTemplate({ from, to, subject, html, cc, bcc, }: {
        from: string;
        to: string;
        subject: string;
        html: string;
        cc?: string;
        bcc?: string;
    }): Promise<string>;
}
