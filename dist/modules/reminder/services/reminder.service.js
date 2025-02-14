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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderService = void 0;
const product_order_schema_1 = require("../../../db/schema/order/product-order.schema");
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const product_schema_1 = require("../../../db/schema/product.schema");
const logger_service_1 = require("../../../common/logger/services/logger.service");
const client_schema_1 = require("../../../db/schema/client.schema");
const order_enum_1 = require("../../../common/types/enums/order.enum");
const amc_schema_1 = require("../../../db/schema/amc/amc.schema");
const mail_service_1 = require("../../../common/mail/service/mail.service");
const reminder_schema_1 = require("../../../db/schema/reminders/reminder.schema");
const config_service_1 = require("../../../common/config/services/config.service");
const storage_service_1 = require("../../../common/storage/services/storage.service");
const email_template_schema_1 = require("../../../db/schema/reminders/email.template.schema");
const misc_1 = require("../../../utils/misc");
let ReminderService = class ReminderService {
    constructor(orderModel, amcModel, reminderModel, emailTemplateModel, loggerService, mailService, configService, storageService) {
        this.orderModel = orderModel;
        this.amcModel = amcModel;
        this.reminderModel = reminderModel;
        this.emailTemplateModel = emailTemplateModel;
        this.loggerService = loggerService;
        this.mailService = mailService;
        this.configService = configService;
        this.storageService = storageService;
        this.INTERNAL_TEAM_EMAIL = this.configService.get('INTERNAL_TEAM_EMAIL');
    }
    async sendTestEmail() {
        const emailStatus = await this.mailService.sendMail({
            template: mail_service_1.MAIL_TEMPLATES.SEND_PENDING_AMC_REMINDER,
            email: this.INTERNAL_TEAM_EMAIL,
            subject: 'Test Email',
            context: {
                client: 'Test Client',
                product: 'Test Product',
                amc: 'Test AMC',
                contacts: 'Test Contacts',
            },
        });
        return emailStatus;
    }
    async checkAMCPendingPaymentsAndSendReminder() {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'Starting AMC pending payments check',
            }));
            const amcs = await this.fetchPendingAMCs();
            this.loggerService.log(JSON.stringify({
                message: 'Retrieved pending AMCs',
                totalAMCs: amcs.length,
            }));
            for (let amc of amcs) {
                this.loggerService.log(JSON.stringify({
                    message: 'Processing AMC',
                    amcId: amc._id,
                    clientId: amc.client_id,
                }));
                const client = amc.client_id;
                const pendindPayment = amc.payments.find((payment) => payment.status === amc_schema_1.PAYMENT_STATUS_ENUM.PENDING);
                const reminderId = `${client._id}-${amc._id}-${pendindPayment._id}`;
                this.loggerService.log(JSON.stringify({
                    message: 'Checking reminder status',
                    reminderId,
                    amcId: amc._id,
                }));
                const shouldSkipReminder = await this.shouldSkipReminder(reminderId);
                if (shouldSkipReminder) {
                    this.loggerService.log(JSON.stringify({
                        message: 'Skipping reminder - already sent recently',
                        reminderId,
                        amcId: amc._id,
                    }));
                    continue;
                }
                const amcsOverDueDetails = this.getOverdueAMCDetails([amc])[0];
                const products = this.getUniqueProducts([amc]);
                if (!amcsOverDueDetails) {
                    this.loggerService.log(JSON.stringify({
                        message: 'Skipping reminder - no overdue payments',
                    }));
                    continue;
                }
                this.loggerService.log(JSON.stringify({
                    message: 'Preparing email context',
                    clientName: client.name,
                    products,
                    amcId: amc._id,
                }));
                const emailContext = {
                    client: client.name,
                    product: products,
                    amc: amcsOverDueDetails,
                    contacts: client.point_of_contacts,
                };
                this.loggerService.log(JSON.stringify({
                    message: 'Sending reminder email',
                    to: this.INTERNAL_TEAM_EMAIL,
                    amcId: amc._id,
                }));
                const status = await this.sendReminderEmail1(this.INTERNAL_TEAM_EMAIL, 'AMC Payment Reminder Alert', mail_service_1.MAIL_TEMPLATES.SEND_PENDING_AMC_REMINDER, emailContext);
                this.loggerService.log(JSON.stringify({
                    message: 'Updating reminder record',
                    reminderId,
                    amcId: amc._id,
                }));
                await this.updateReminder({
                    reminder_id: reminderId,
                    to: this.INTERNAL_TEAM_EMAIL,
                    subject: 'AMC Payment Reminder Alert',
                    template: mail_service_1.MAIL_TEMPLATES.SEND_PENDING_AMC_REMINDER,
                    context: emailContext,
                    status,
                    client_id: client._id,
                    order_id: amc.order_id.toString(),
                    amc_id: amc._id,
                    total_attempts: 1,
                });
                this.loggerService.log(JSON.stringify({
                    message: 'Successfully processed AMC',
                    amcId: amc._id,
                }));
            }
            this.loggerService.log(JSON.stringify({
                message: 'Completed AMC pending payments check',
                totalProcessed: amcs.length,
            }));
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'Critical error in checkAMCPendingPaymentsAndSendReminder',
                error: error.message,
                stack: error.stack,
            }));
            throw error;
        }
    }
    async sendReminderEmail1(email, subject, template, context) {
        try {
            const emailStatus = await this.mailService.sendMail({
                template,
                email,
                subject,
                context,
            });
            return emailStatus;
        }
        catch (error) {
            this.loggerService.error('Critical error in sendReminderEmail', JSON.stringify(error));
            throw error;
        }
    }
    async updateReminder(data) {
        try {
            const { reminder_id } = data;
            const existingReminder = await this.reminderModel.findOne({
                reminder_id,
            });
            const from = this.configService.get('EMAIL_ID');
            if (existingReminder) {
                existingReminder.total_attempts += 1;
                this.loggerService.log('updateReminder: Reminder already exists, updating total attempts');
                await existingReminder.save();
            }
            else {
                this.loggerService.log('updateReminder: Creating new reminder');
                const newReminder = new this.reminderModel({ ...data, from });
                await newReminder.save();
            }
            return { message: 'Reminder updated successfully' };
        }
        catch (error) {
            this.loggerService.error('updateReminder: Critical error', JSON.stringify(error));
            throw error;
        }
    }
    async fetchPendingAMCs() {
        return this.amcModel
            .find({ 'payments.status': amc_schema_1.PAYMENT_STATUS_ENUM.PENDING })
            .populate([
            { path: 'client_id', model: client_schema_1.Client.name },
            { path: 'products', model: product_schema_1.Product.name },
        ]);
    }
    async shouldSkipReminder(reminderId) {
        const MIN_DAYS_BETWEEN_REMINDERS = 7;
        const existingReminder = await this.reminderModel.findOne({
            reminder_id: reminderId,
        });
        if (!existingReminder)
            return false;
        const daysSinceLastReminder = Math.floor((new Date().getTime() - new Date(existingReminder.createdAt).getTime()) /
            (1000 * 60 * 60 * 24));
        return daysSinceLastReminder <= MIN_DAYS_BETWEEN_REMINDERS;
    }
    getOverdueAMCDetails(amcs) {
        return amcs
            .map((amc) => {
            const pendingPayments = amc.payments.filter((p) => p.status === amc_schema_1.PAYMENT_STATUS_ENUM.PENDING);
            return pendingPayments
                .map((payment) => {
                const MILLISECONDS_PER_SECOND = 1000;
                const SECONDS_PER_MINUTE = 60;
                const MINUTES_PER_HOUR = 60;
                const HOURS_PER_DAY = 24;
                const MILLISECONDS_PER_DAY = MILLISECONDS_PER_SECOND *
                    SECONDS_PER_MINUTE *
                    MINUTES_PER_HOUR *
                    HOURS_PER_DAY;
                const overdueDays = Math.floor((new Date().getTime() - new Date(payment.from_date).getTime()) /
                    MILLISECONDS_PER_DAY);
                if (overdueDays <= 0)
                    return null;
                return {
                    cycle: `${new Date(payment.from_date).toLocaleDateString()} to ${new Date(payment.to_date).toLocaleDateString()}`,
                    amount: (0, misc_1.formatCurrency)(amc.amount),
                    date: new Date(payment.from_date).toLocaleDateString(),
                    overdue: overdueDays,
                    link: `${this.configService.get('CLIENT_URL')}/amc/${amc.order_id}`,
                };
            })
                .filter(Boolean);
        })
            .flat();
    }
    getUniqueProducts(amcs) {
        return amcs
            .map((amc) => amc.products.map((product) => product.name).join(', '))
            .filter((value, index, self) => self.indexOf(value) === index)
            .join(', ');
    }
    async checkAMCUpcomingPaymentsAndSendReminder() {
        try {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            this.loggerService.log(JSON.stringify({
                message: 'Checking for payments due in next month',
                nextMonth: nextMonth.toISOString(),
            }));
            const amcs = await this.amcModel
                .find({
                $and: [
                    {
                        'payments.from_date': {
                            $gte: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1),
                            $lte: new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0),
                        },
                    },
                    { 'payments.status': amc_schema_1.PAYMENT_STATUS_ENUM.PENDING },
                ],
            })
                .populate([
                { path: 'client_id', model: client_schema_1.Client.name },
                { path: 'products', model: product_schema_1.Product.name },
            ])
                .lean();
            for (let amc of amcs) {
                const amcDetail = await this.getUpcomingAMCDetails([amc], nextMonth);
                const client = amc.client_id;
                const upcomingPayment = amc.payments.find((payment) => {
                    const dueDate = new Date(payment.from_date);
                    return (dueDate.getMonth() === nextMonth.getMonth() &&
                        dueDate.getFullYear() === nextMonth.getFullYear());
                });
                if (!upcomingPayment) {
                    this.loggerService.log(JSON.stringify({
                        message: 'Skipping reminder - no upcoming payments',
                    }));
                    continue;
                }
                const uniqueProducts = this.getUniqueProducts([amc]);
                const reminderId = `${client._id}-${amc._id}-${upcomingPayment._id}`;
                const shouldSkipReminder = await this.shouldSkipReminder(reminderId);
                if (shouldSkipReminder) {
                    this.loggerService.log(JSON.stringify({
                        message: 'Skipping reminder - already sent recently',
                        reminderId,
                        amcId: amc._id,
                    }));
                    continue;
                }
                const emailContext = {
                    client: client.name,
                    product: uniqueProducts,
                    contacts: client.point_of_contacts,
                    amc: amcDetail[0],
                };
                this.loggerService.log(JSON.stringify({
                    message: 'Sending reminder email',
                    to: this.INTERNAL_TEAM_EMAIL,
                    amcId: amc._id,
                }));
                const emailStatus = await this.sendReminderEmail1(this.INTERNAL_TEAM_EMAIL, 'AMC Payment Reminder Alert', mail_service_1.MAIL_TEMPLATES.SEND_UPCOMING_AMC_REMINDER, emailContext);
                await this.updateReminder({
                    reminder_id: reminderId,
                    to: this.INTERNAL_TEAM_EMAIL,
                    subject: 'AMC Payment Reminder Alert',
                    template: mail_service_1.MAIL_TEMPLATES.SEND_UPCOMING_AMC_REMINDER,
                    context: emailContext,
                    status: emailStatus,
                    client_id: client._id,
                    order_id: amc.order_id.toString(),
                    amc_id: amc._id,
                    total_attempts: 1,
                });
                this.loggerService.log(JSON.stringify({
                    message: 'Successfully processed AMC',
                    amcId: amc._id,
                }));
            }
        }
        catch (error) {
            this.loggerService.error('Critical error in checkAMCUpcomingPaymentsAndSendReminder', JSON.stringify(error));
            throw error;
        }
    }
    async getUpcomingAMCDetails(amcs, nextMonth) {
        const amcDetails = amcs
            .map((amc) => {
            const upcomingPayments = amc.payments.filter((p) => {
                const dueDate = new Date(p.from_date);
                return (dueDate.getMonth() === nextMonth.getMonth() &&
                    dueDate.getFullYear() === nextMonth.getFullYear());
            });
            return upcomingPayments.map((payment) => {
                return {
                    cycle: `${new Date(payment.from_date).toLocaleDateString()} to ${new Date(payment.to_date).toLocaleDateString()}`,
                    amount: amc.amount.toFixed(2),
                    date: new Date(payment.from_date).toLocaleDateString(),
                    upcoming: Math.floor((new Date(payment.from_date).getTime() - new Date().getTime()) /
                        (1000 * 60 * 60 * 24)),
                    link: `${this.configService.get('CLIENT_URL')}/amc/${amc.order_id}`,
                    updateLink: `${this.configService.get('APP_URL')}/amc/${amc.order_id}/update-payment/${payment._id}`,
                };
            });
        })
            .flat();
        return amcDetails;
    }
    async checkAgreementExpiryAndSendReminder() {
        try {
            const orders = await this.orderModel
                .find({ status: order_enum_1.ORDER_STATUS_ENUM.ACTIVE })
                .populate([
                {
                    path: 'client_id',
                    model: client_schema_1.Client.name,
                },
                {
                    path: 'products',
                    model: product_schema_1.Product.name,
                    select: 'name short_name',
                },
            ]);
            this.loggerService.log(JSON.stringify({
                message: 'Filtered expiring orders',
                totalExpiringOrders: orders.length,
            }));
            const expiringOrders = orders.filter((order) => {
                if (!order?.agreements?.length)
                    return false;
                const lastAgreement = order.agreements[order.agreements.length - 1];
                const expiryDate = new Date(lastAgreement.end);
                const today = new Date();
                const nextMonth = new Date();
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                return expiryDate > today && expiryDate < nextMonth;
            });
            this.loggerService.log(JSON.stringify({
                message: 'Filtered expiring orders',
                totalExpiringOrders: expiringOrders.length,
            }));
            for (let order of expiringOrders) {
                const agreementDetails = this.getExpiringAgreementDetails([order]);
                const lastAgreement = order.agreements[order.agreements.length - 1];
                if (agreementDetails.length === 0) {
                    this.loggerService.log(JSON.stringify({
                        message: 'No expiring agreements found for client',
                        clientId: order.client_id,
                    }));
                    continue;
                }
                const client = order.client_id;
                const reminderId = `${client._id}-${order._id}-${lastAgreement._id}`;
                const shouldSkipReminder = await this.shouldSkipReminder(reminderId);
                if (shouldSkipReminder) {
                    this.loggerService.log(JSON.stringify({
                        message: 'Skipping reminder - already sent recently',
                        reminderId,
                        clientId: client._id,
                    }));
                    continue;
                }
                const emailContext = {
                    client: client.name,
                    clientId: client._id,
                    agreement: agreementDetails[0],
                    contacts: client.point_of_contacts,
                };
                const emailStatus = await this.sendReminderEmail1(this.INTERNAL_TEAM_EMAIL, 'Agreement Expiry Reminder Alert', mail_service_1.MAIL_TEMPLATES.SEND_AGREEMENT_EXPIRY_REMINDER, emailContext);
                await this.updateReminder({
                    reminder_id: reminderId,
                    to: this.INTERNAL_TEAM_EMAIL,
                    subject: 'Agreement Expiry Reminder Alert',
                    template: mail_service_1.MAIL_TEMPLATES.SEND_AGREEMENT_EXPIRY_REMINDER,
                    context: emailContext,
                    status: emailStatus,
                    client_id: client._id,
                    order_id: order._id.toString(),
                    total_attempts: 1,
                });
                this.loggerService.log(JSON.stringify({
                    message: 'Successfully processed client',
                    clientId: client._id,
                    totalAgreements: agreementDetails.length,
                }));
            }
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'Critical error in agreement expiry check process',
                error: error.message,
                stack: error.stack,
            }));
            throw error;
        }
    }
    getExpiringAgreementDetails(orders) {
        try {
            const details = orders.map((order) => {
                const lastAgreement = order.agreements[order.agreements.length - 1];
                const expiryDate = new Date(lastAgreement.end);
                const daysToExpiry = Math.floor((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                const client = order.client_id;
                return {
                    product: order.products.map((p) => p.name).join(', '),
                    expiryDate: expiryDate.toLocaleDateString(),
                    expiry: daysToExpiry,
                    document: this.storageService.get(lastAgreement.document),
                    link: `${this.configService.get('CLIENT_URL')}/purchases/${order._id}?type=order&client=${client._id}`,
                };
            });
            this.loggerService.log(JSON.stringify({
                message: 'Generated agreement details',
                totalDetails: details.length,
            }));
            return details;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'Error getting agreement details',
                error: error.message,
            }));
            throw error;
        }
    }
    async getAllInternalReminders() {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'Fetching all reminders',
            }));
            const reminders = await this.reminderModel
                .find({
                communication_type: reminder_schema_1.COMMUNICATION_TYPE.INTERNAL,
            })
                .populate({
                path: 'client_id',
                model: client_schema_1.Client.name,
                select: 'name',
            });
            const remindersWithClient = [];
            for (const reminder of reminders) {
                const client = reminder.client_id;
                remindersWithClient.push({
                    ...reminder.toObject(),
                    client: client.name,
                });
            }
            this.loggerService.log(JSON.stringify({
                message: 'Successfully retrieved all reminders',
                totalReminders: remindersWithClient.length,
            }));
            return remindersWithClient;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'Error retrieving reminders',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getReminderById(id) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'Fetching reminder by ID',
                id,
            }));
            const reminder = await this.reminderModel.findById(id).populate([
                {
                    path: 'client_id',
                    model: client_schema_1.Client.name,
                    select: 'name point_of_contacts industry',
                },
                {
                    path: 'order_id',
                    model: product_order_schema_1.Order.name,
                    select: 'products agreements amc_start_date base_cost',
                },
                {
                    path: 'amc_id',
                    model: amc_schema_1.AMC.name,
                },
            ]);
            if (!reminder) {
                this.loggerService.error(JSON.stringify({
                    message: 'Reminder not found',
                    id,
                }));
                throw new Error('Reminder not found');
            }
            const reminderObj = reminder.toObject();
            if (reminderObj.client_id) {
                reminderObj['client'] = reminderObj.client_id;
                delete reminderObj.client_id;
            }
            if (reminderObj.order_id) {
                reminderObj['order'] = reminderObj.order_id;
                delete reminderObj.order_id;
            }
            if (reminderObj.amc_id) {
                reminderObj['amc'] = reminderObj.amc_id;
                delete reminderObj.amc_id;
            }
            this.loggerService.log(JSON.stringify({
                message: 'Successfully retrieved reminder',
                id,
            }));
            return reminderObj;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'Error retrieving reminder',
                error: error.message,
                id,
            }));
            throw new common_1.HttpException(error.message, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async sendEmailToClient(data) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'Sending email to client',
                to: data.to,
                subject: data.subject,
            }));
            const emailStatus = await this.mailService.sendMailWithoutTemplate({
                from: data.from,
                to: data.to,
                cc: data.cc,
                bcc: data.bcc,
                subject: data.subject,
                html: data.body,
            });
            const reminderId = `${data.from}-${data.to}-${data.email_template_id}`;
            const emailTemplate = await this.emailTemplateModel.findById(data.email_template_id);
            const newReminder = new this.reminderModel({
                reminder_id: reminderId,
                to: data.to,
                from: data.from,
                subject: data.subject,
                template: emailTemplate.key,
                email_template_id: data.email_template_id,
                context: data.body,
                status: emailStatus,
                total_attempts: 1,
                communication_type: reminder_schema_1.COMMUNICATION_TYPE.EXTERNAL,
                body: data.body,
                customization_id: data.customization_id,
                license_id: data.license_id,
                order_id: data.order_id,
                amc_id: data.amc_id,
                client_id: data.client_id,
            });
            await newReminder.save();
            this.loggerService.log(JSON.stringify({
                message: 'Email sent successfully',
                to: data.to,
                subject: data.subject,
                status: emailStatus,
            }));
            return emailStatus;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'Critical error in sendEmailToClient',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getEmailTemplates() {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'Fetching email templates',
            }));
            const templates = await this.emailTemplateModel.find();
            this.loggerService.log(JSON.stringify({
                message: 'Successfully retrieved email templates',
                totalTemplates: templates.length,
            }));
            return templates;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'Error retrieving email templates',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getExternalCommunicationHistory() {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'Fetching external communication history',
            }));
            const communications = await this.reminderModel
                .find({ communication_type: reminder_schema_1.COMMUNICATION_TYPE.EXTERNAL })
                .populate([
                {
                    path: 'client_id',
                    model: client_schema_1.Client.name,
                    select: 'name point_of_contacts industry',
                },
                {
                    path: 'order_id',
                    model: product_order_schema_1.Order.name,
                    select: 'products agreements amc_start_date base_cost',
                },
                {
                    path: 'amc_id',
                    model: amc_schema_1.AMC.name,
                },
                {
                    path: 'email_template_id',
                    model: email_template_schema_1.EmailTemplate.name,
                },
            ]);
            const communicationsWithClient = communications.map((communication) => {
                const communicationObj = communication.toObject();
                if (communicationObj.client_id) {
                    communicationObj['client'] = communicationObj.client_id;
                    delete communicationObj.client_id;
                }
                if (communicationObj.order_id) {
                    communicationObj['order'] = communicationObj.order_id;
                    delete communicationObj.order_id;
                }
                if (communicationObj.amc_id) {
                    communicationObj['amc'] = communicationObj.amc_id;
                    delete communicationObj.amc_id;
                }
                if (communicationObj.email_template_id) {
                    communicationObj['email_template'] =
                        communicationObj.email_template_id;
                    delete communicationObj.email_template_id;
                }
                return communicationObj;
            });
            this.loggerService.log(JSON.stringify({
                message: 'Successfully retrieved external communication history',
                totalCommunications: communicationsWithClient.length,
            }));
            return communicationsWithClient;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'Error retrieving external communication history',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.ReminderService = ReminderService;
exports.ReminderService = ReminderService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(product_order_schema_1.Order.name)),
    __param(1, (0, mongoose_1.InjectModel)(amc_schema_1.AMC.name)),
    __param(2, (0, mongoose_1.InjectModel)(reminder_schema_1.Reminder.name)),
    __param(3, (0, mongoose_1.InjectModel)(email_template_schema_1.EmailTemplate.name)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, logger_service_1.LoggerService,
        mail_service_1.MailService,
        config_service_1.ConfigService,
        storage_service_1.StorageService])
], ReminderService);
//# sourceMappingURL=reminder.service.js.map