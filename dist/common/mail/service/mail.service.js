"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = exports.MAIL_TEMPLATES = void 0;
const common_1 = require("@nestjs/common");
const mailer_1 = require("@nestjs-modules/mailer");
const logger_service_1 = require("../../logger/services/logger.service");
var MAIL_TEMPLATES;
(function (MAIL_TEMPLATES) {
    MAIL_TEMPLATES["SEND_UPCOMING_AMC_REMINDER"] = "amc-upcoming-reminder";
    MAIL_TEMPLATES["SEND_PENDING_AMC_REMINDER"] = "amc-pending-reminder";
    MAIL_TEMPLATES["SEND_AGREEMENT_EXPIRY_REMINDER"] = "agreement-expiry-reminder";
    MAIL_TEMPLATES["EXTERNAL_REMINDER_TO_CLIENT"] = "external-reminder-to-client";
})(MAIL_TEMPLATES || (exports.MAIL_TEMPLATES = MAIL_TEMPLATES = {}));
let MailService = class MailService {
    constructor(mailerService, loggerService) {
        this.mailerService = mailerService;
        this.loggerService = loggerService;
    }
    async sendMail({ email, subject, context, template, attachments, }) {
        try {
            if (!template) {
                throw new Error('Template not found');
            }
            this.loggerService.log(JSON.stringify({
                message: `Sending email to ${email} with subject: ${subject}`,
                context,
            }));
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
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'Error sending email',
                error,
            }));
            throw new Error(JSON.stringify({ error }));
        }
    }
    async sendMailWithoutTemplate({ from, to, subject, html, cc, bcc, }) {
        try {
            this.loggerService.log(JSON.stringify({
                message: `Sending email to ${to} with subject: ${subject}`,
                html,
            }));
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
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'Error sending email',
                error,
            }));
            throw new Error(JSON.stringify({ error }));
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mailer_1.MailerService,
        logger_service_1.LoggerService])
], MailService);
//# sourceMappingURL=mail.service.js.map