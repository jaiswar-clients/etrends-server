import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { LoggerService } from '@/common/logger/services/logger.service';

export enum MAIL_TEMPLATES {
  SEND_UPCOMING_AMC_REMINDER = 'amc-upcoming-reminder',
  SEND_PENDING_AMC_REMINDER = 'amc-pending-reminder',
  SEND_AGREEMENT_EXPIRY_REMINDER = 'agreement-expiry-reminder',
  EXTERNAL_REMINDER_TO_CLIENT = 'external-reminder-to-client',
}

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private loggerService: LoggerService,
  ) {}

  async sendMail({
    email,
    subject,
    context,
    template,
    attachments,
  }: {
    email: string;
    subject: string;
    template: MAIL_TEMPLATES;
    context: any;
    attachments?: { filename: string; path: string; contentType?: string }[];
  }): Promise<string> {
    try {
      if (!template) {
        throw new Error('Template not found');
      }

      this.loggerService.log(
        JSON.stringify({
          message: `Sending email to ${email} with subject: ${subject}`,
          context,
        }),
      );

      const templateId = `${template}.template.pug`;

      const res = await this.mailerService.sendMail({
        to: email,
        subject,
        template: templateId,
        context,
        attachments,
      });
      this.loggerService.log(`Email sent successfully to ${email}`);

      const status = res.accepted.includes(email) ? 'sent' : 'failed';

      return status;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Error sending email',
          error,
        }),
      );
      throw new Error(JSON.stringify({ error }));
    }
  }

  // create a service which sends email to the client withoug template with cc and bcc
  async sendMailWithoutTemplate({
    from,
    to,
    subject,
    html,
    cc,
    bcc,
  }: {
    from: string;
    to: string;
    subject: string;
    html: string;
    cc?: string;
    bcc?: string;
  }): Promise<string> {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: `Sending email to ${to} with subject: ${subject}`,
          html,
        }),
      );

      const res = await this.mailerService.sendMail({
        to,
        subject,
        html,
        cc,
        bcc,
      });
      this.loggerService.log(`Email sent successfully to ${to}`);

      const status = res.accepted.includes(to) ? 'sent' : 'failed';

      return status;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Error sending email',
          error,
        }),
      );
      throw new Error(JSON.stringify({ error }));
    }
  }
}
