import {
  Customization,
  CustomizationDocument,
} from '@/db/schema/order/customization.schema';
import { License, LicenseDocument } from '@/db/schema/order/license.schema';
import { Order, OrderDocument } from '@/db/schema/order/product-order.schema';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'mongoose-delete';

import { Product, ProductDocument } from '@/db/schema/product.schema';
import { LoggerService } from '@/common/logger/services/logger.service';
import { Client, ClientDocument } from '@/db/schema/client.schema';

import {
  AdditionalService,
  AdditionalServiceDocument,
} from '@/db/schema/order/additional-service.schema';

import { ORDER_STATUS_ENUM } from '@/common/types/enums/order.enum';
import {
  AMC,
  AMCDocument,
  PAYMENT_STATUS_ENUM,
} from '@/db/schema/amc/amc.schema';

import {
  MAIL_TEMPLATES,
  MailService,
} from '@/common/mail/service/mail.service';
import {
  COMMUNICATION_TYPE,
  Reminder,
  ReminderDocument,
} from '@/db/schema/reminders/reminder.schema';
import { ConfigService } from '@/common/config/services/config.service';
import { SendEmailDto } from '../dto/send-email';
import { StorageService } from '@/common/storage/services/storage.service';
import {
  EmailTemplate,
  EmailTemplateDocument,
} from '@/db/schema/reminders/email.template.schema';

@Injectable()
export class ReminderService {
  private INTERNAL_TEAM_EMAIL: string;
  constructor(
    @InjectModel(Order.name)
    private orderModel: SoftDeleteModel<OrderDocument>,
    @InjectModel(AMC.name)
    private amcModel: SoftDeleteModel<AMCDocument>,
    @InjectModel(Reminder.name)
    private reminderModel: SoftDeleteModel<ReminderDocument>,
    @InjectModel(EmailTemplate.name)
    private emailTemplateModel: SoftDeleteModel<EmailTemplateDocument>,
    private loggerService: LoggerService,
    private mailService: MailService,
    private configService: ConfigService,
    private storageService: StorageService,
  ) {
    this.INTERNAL_TEAM_EMAIL = 'jaiswar.newsletter@gmail.com';
  }

  // ******************* REMINDER SCHEDULERS - START *******************

  async checkAMCPendingPaymentsAndSendReminder() {
    // This function will send reminder separately for each AMC
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'Starting AMC pending payments check',
        }),
      );

      const amcs = await this.fetchPendingAMCs();

      this.loggerService.log(
        JSON.stringify({
          message: 'Retrieved pending AMCs',
          totalAMCs: amcs.length,
        }),
      );

      for (let amc of amcs) {
        this.loggerService.log(
          JSON.stringify({
            message: 'Processing AMC',
            amcId: amc._id,
            clientId: amc.client_id,
          }),
        );
        const client = amc.client_id as unknown as ClientDocument;

        const pendindPayment = amc.payments.find(
          (payment) => payment.status === PAYMENT_STATUS_ENUM.PENDING,
        );
        const reminderId = `${client._id}-${amc._id}-${pendindPayment._id}`;

        this.loggerService.log(
          JSON.stringify({
            message: 'Checking reminder status',
            reminderId,
            amcId: amc._id,
          }),
        );

        const shouldSkipReminder = await this.shouldSkipReminder(reminderId);
        if (shouldSkipReminder) {
          this.loggerService.log(
            JSON.stringify({
              message: 'Skipping reminder - already sent recently',
              reminderId,
              amcId: amc._id,
            }),
          );
          continue;
        }

        const amcsOverDueDetails = this.getOverdueAMCDetails([amc])[0];
        const products = this.getUniqueProducts([amc]);

        this.loggerService.log(
          JSON.stringify({
            message: 'Preparing email context',
            clientName: client.name,
            products,
            amcId: amc._id,
          }),
        );

        const emailContext = {
          client: client.name,
          product: products,
          amc: amcsOverDueDetails,
          contacts: client.point_of_contacts,
        };

        this.loggerService.log(
          JSON.stringify({
            message: 'Sending reminder email',
            to: this.INTERNAL_TEAM_EMAIL,
            amcId: amc._id,
          }),
        );

        const status = await this.sendReminderEmail1(
          this.INTERNAL_TEAM_EMAIL,
          'AMC Payment Reminder Alert',
          MAIL_TEMPLATES.SEND_PENDING_AMC_REMINDER,
          emailContext,
        );

        this.loggerService.log(
          JSON.stringify({
            message: 'Updating reminder record',
            reminderId,
            amcId: amc._id,
          }),
        );

        await this.updateReminder({
          reminder_id: reminderId,
          to: this.INTERNAL_TEAM_EMAIL,
          subject: 'AMC Payment Reminder Alert',
          template: MAIL_TEMPLATES.SEND_PENDING_AMC_REMINDER,
          context: emailContext,
          status,
          client_id: client._id as string,
          order_id: amc.order_id.toString(),
          amc_id: amc._id as string,
          total_attempts: 1,
        });

        this.loggerService.log(
          JSON.stringify({
            message: 'Successfully processed AMC',
            amcId: amc._id,
          }),
        );
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'Completed AMC pending payments check',
          totalProcessed: amcs.length,
        }),
      );
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Critical error in checkAMCPendingPaymentsAndSendReminder',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw error;
    }
  }

  async sendReminderEmail1(
    email: string,
    subject: string,
    template: MAIL_TEMPLATES,
    context: any,
  ) {
    try {
      const emailStatus = await this.mailService.sendMail({
        template,
        email,
        subject,
        context,
      });

      return emailStatus;
    } catch (error) {
      this.loggerService.error(
        'Critical error in sendReminderEmail',
        JSON.stringify(error),
      );
      throw error;
    }
  }

  private async updateReminder(
    data: Partial<{
      reminder_id: string;
      to: string;
      subject: string;
      template: MAIL_TEMPLATES;
      context: any;
      status: string;
      client_id?: string;
      order_id?: string;
      amc_id?: string;
      license_id?: string;
      customization_id?: string;
      total_attempts?: number;
    }>,
  ) {
    try {
      const { reminder_id } = data;
      const existingReminder = await this.reminderModel.findOne({
        reminder_id,
      });

      const from = this.configService.get('EMAIL_ID');

      if (existingReminder) {
        existingReminder.total_attempts += 1;
        this.loggerService.log(
          'updateReminder: Reminder already exists, updating total attempts',
        );
        await existingReminder.save();
      } else {
        this.loggerService.log('updateReminder: Creating new reminder');
        const newReminder = new this.reminderModel({ ...data, from });
        await newReminder.save();
      }

      return { message: 'Reminder updated successfully' };
    } catch (error) {
      this.loggerService.error(
        'updateReminder: Critical error',
        JSON.stringify(error),
      );
      throw error;
    }
  }

  private async fetchPendingAMCs() {
    return this.amcModel
      .find({ 'payments.status': PAYMENT_STATUS_ENUM.PENDING })
      .populate([
        { path: 'client_id', model: Client.name },
        { path: 'products', model: Product.name },
      ]);
  }

  private async shouldSkipReminder(reminderId: string) {
    const MIN_DAYS_BETWEEN_REMINDERS = 7;
    const existingReminder = await this.reminderModel.findOne({
      reminder_id: reminderId,
    });
    if (!existingReminder) return false;

    const daysSinceLastReminder = Math.floor(
      (new Date().getTime() - new Date(existingReminder.createdAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    return daysSinceLastReminder <= MIN_DAYS_BETWEEN_REMINDERS;
  }

  private getOverdueAMCDetails(amcs: AMCDocument[]) {
    return amcs
      .map((amc) => {
        const pendingPayments = amc.payments.filter(
          (p) => p.status === PAYMENT_STATUS_ENUM.PENDING,
        );

        return pendingPayments
          .map((payment) => {
            const overdueDays = Math.floor(
              (new Date().getTime() - new Date(payment.from_date).getTime()) /
                (1000 * 60 * 60 * 24),
            );

            if (overdueDays <= 0) return null;

            return {
              cycle: `${new Date(payment.from_date).toLocaleDateString()} to ${new Date(payment.to_date).toLocaleDateString()}`,
              amount: amc.amount.toFixed(2),
              date: new Date(payment.from_date).toLocaleDateString(),
              overdue: overdueDays,
              link: `${this.configService.get('CLIENT_URL')}/amc/${amc.order_id}`,
            };
          })
          .filter(Boolean);
      })
      .flat();
  }

  private getUniqueProducts(amcs: AMCDocument[]) {
    return amcs
      .map((amc) => amc.products.map((product: any) => product.name).join(', '))
      .filter((value, index, self) => self.indexOf(value) === index)
      .join(', ');
  }

  // create a checkUpcomingDueDate handler which checks for upcoming due dates in next month, i.e if the due date is in next month then send a reminder to the client
  async checkAMCUpcomingPaymentsAndSendReminder() {
    // This function will send reminder separately for each AMC
    try {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      this.loggerService.log(
        JSON.stringify({
          message: 'Checking for payments due in next month',
          nextMonth: nextMonth.toISOString(),
        }),
      );

      // Find AMCs with payments due next month
      const amcs = await this.amcModel
        .find({
          $and: [
            {
              'payments.from_date': {
                $gte: new Date(
                  nextMonth.getFullYear(),
                  nextMonth.getMonth(),
                  1,
                ),
                $lte: new Date(
                  nextMonth.getFullYear(),
                  nextMonth.getMonth() + 1,
                  0,
                ),
              },
            },
            { 'payments.status': PAYMENT_STATUS_ENUM.PENDING },
          ],
        })
        .populate([
          { path: 'client_id', model: Client.name },
          { path: 'products', model: Product.name },
        ])
        .lean();

      for (let amc of amcs) {
        const amcDetail = await this.getUpcomingAMCDetails(
          [amc as AMCDocument],
          nextMonth,
        );
        const client = amc.client_id as unknown as ClientDocument;
        const upcomingPayment = amc.payments.find((payment) => {
          const dueDate = new Date(payment.from_date);
          return (
            dueDate.getMonth() === nextMonth.getMonth() &&
            dueDate.getFullYear() === nextMonth.getFullYear()
          );
        });
        const uniqueProducts = this.getUniqueProducts([amc as AMCDocument]);
        const reminderId = `${client._id}-${amc._id}-${upcomingPayment._id}`;

        const shouldSkipReminder = await this.shouldSkipReminder(reminderId);
        if (shouldSkipReminder) {
          this.loggerService.log(
            JSON.stringify({
              message: 'Skipping reminder - already sent recently',
              reminderId,
              amcId: amc._id,
            }),
          );
          continue;
        }

        const emailContext = {
          client: client.name,
          product: uniqueProducts,
          contacts: client.point_of_contacts,
          amc: amcDetail[0],
        };

        const emailStatus = await this.sendReminderEmail1(
          this.INTERNAL_TEAM_EMAIL,
          'AMC Payment Reminder Alert',
          MAIL_TEMPLATES.SEND_UPCOMING_AMC_REMINDER,
          emailContext,
        );

        await this.updateReminder({
          reminder_id: reminderId,
          to: this.INTERNAL_TEAM_EMAIL,
          subject: 'AMC Payment Reminder Alert',
          template: MAIL_TEMPLATES.SEND_UPCOMING_AMC_REMINDER,
          context: emailContext,
          status: emailStatus,
          client_id: client._id as string,
          order_id: amc.order_id.toString(),
          amc_id: amc._id as string,
          total_attempts: 1,
        });

        this.loggerService.log(
          JSON.stringify({
            message: 'Successfully processed AMC',
            amcId: amc._id,
          }),
        );
      }
    } catch (error) {
      this.loggerService.error(
        'Critical error in checkAMCUpcomingPaymentsAndSendReminder',
        JSON.stringify(error),
      );
      throw error;
    }
  }

  async getUpcomingAMCDetails(amcs: AMCDocument[], nextMonth: Date) {
    const amcDetails = amcs
      .map((amc) => {
        const upcomingPayments = amc.payments.filter((p) => {
          const dueDate = new Date(p.from_date);
          return (
            dueDate.getMonth() === nextMonth.getMonth() &&
            dueDate.getFullYear() === nextMonth.getFullYear()
          );
        });

        return upcomingPayments.map((payment) => {
          return {
            cycle: `${new Date(payment.from_date).toLocaleDateString()} to ${new Date(payment.to_date).toLocaleDateString()}`,
            amount: amc.amount.toFixed(2),
            date: new Date(payment.from_date).toLocaleDateString(),
            upcoming: Math.floor(
              (new Date(payment.from_date).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24),
            ),
            link: `${this.configService.get('CLIENT_URL')}/amc/${amc.order_id}`,
            updateLink: `${this.configService.get('APP_URL')}/amc/${amc.order_id}/update-payment/${payment._id}`,
          };
        });
      })
      .flat();
    return amcDetails;
  }

  async checkAgreementExpiryAndSendReminder() {
    // This function will send reminder separately for each client for each order
    try {
      const orders = await this.orderModel
        .find({ status: ORDER_STATUS_ENUM.ACTIVE })
        .populate([
          {
            path: 'client_id',
            model: Client.name,
          },
          {
            path: 'products',
            model: Product.name,
            select: 'name short_name',
          },
        ]);

      this.loggerService.log(
        JSON.stringify({
          message: 'Filtered expiring orders',
          totalExpiringOrders: orders.length,
        }),
      );

      // Filter orders with agreement expiry in next 30 days
      const expiringOrders = orders.filter((order) => {
        const lastAgreement = order.agreements[order.agreements.length - 1];
        const expiryDate = new Date(lastAgreement.end);
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        return expiryDate > today && expiryDate < nextMonth;
      });

      this.loggerService.log(
        JSON.stringify({
          message: 'Filtered expiring orders',
          totalExpiringOrders: expiringOrders.length,
        }),
      );

      for (let order of expiringOrders) {
        const agreementDetails = this.getExpiringAgreementDetails([order]);
        const lastAgreement = order.agreements[order.agreements.length - 1];
        if (agreementDetails.length === 0) {
          this.loggerService.log(
            JSON.stringify({
              message: 'No expiring agreements found for client',
              clientId: order.client_id,
            }),
          );
          continue;
        }
        const client = order.client_id as unknown as ClientDocument;
        const reminderId = `${client._id}-${order._id}-${lastAgreement._id}`;
        const shouldSkipReminder = await this.shouldSkipReminder(reminderId);

        if (shouldSkipReminder) {
          this.loggerService.log(
            JSON.stringify({
              message: 'Skipping reminder - already sent recently',
              reminderId,
              clientId: client._id,
            }),
          );
          continue;
        }

        const emailContext = {
          client: client.name,
          clientId: client._id,
          agreement: agreementDetails[0],
          contacts: client.point_of_contacts,
        };

        const emailStatus = await this.sendReminderEmail1(
          this.INTERNAL_TEAM_EMAIL,
          'Agreement Expiry Reminder Alert',
          MAIL_TEMPLATES.SEND_AGREEMENT_EXPIRY_REMINDER,
          emailContext,
        );

        await this.updateReminder({
          reminder_id: reminderId,
          to: this.INTERNAL_TEAM_EMAIL,
          subject: 'Agreement Expiry Reminder Alert',
          template: MAIL_TEMPLATES.SEND_AGREEMENT_EXPIRY_REMINDER,
          context: emailContext,
          status: emailStatus,
          client_id: client._id as string,
          order_id: order._id.toString(),
          total_attempts: 1,
        });

        this.loggerService.log(
          JSON.stringify({
            message: 'Successfully processed client',
            clientId: client._id,
            totalAgreements: agreementDetails.length,
          }),
        );
      }
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Critical error in agreement expiry check process',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw error;
    }
  }

  private getExpiringAgreementDetails(orders: OrderDocument[]) {
    try {
      const details = orders.map((order) => {
        const lastAgreement = order.agreements[order.agreements.length - 1];
        const expiryDate = new Date(lastAgreement.end);
        const daysToExpiry = Math.floor(
          (expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
        );
        const client = order.client_id as unknown as ClientDocument;

        return {
          product: order.products.map((p: any) => p.name).join(', '),
          expiryDate: expiryDate.toLocaleDateString(),
          expiry: daysToExpiry,
          document: this.storageService.get(lastAgreement.document),
          link: `${this.configService.get('CLIENT_URL')}/purchases/${order._id}?type=order&client=${client._id}`,
        };
      });

      this.loggerService.log(
        JSON.stringify({
          message: 'Generated agreement details',
          totalDetails: details.length,
        }),
      );

      return details;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Error getting agreement details',
          error: error.message,
        }),
      );
      throw error;
    }
  }

  // ******************* REMINDER SCHEDULERS - END *******************

  async getAllInternalReminders() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'Fetching all reminders',
        }),
      );

      const reminders = await this.reminderModel
        .find({
          communication_type: COMMUNICATION_TYPE.INTERNAL,
        })
        .populate({
          path: 'client_id',
          model: Client.name,
          select: 'name',
        });

      // convert reminders to Object and add client in each reminder
      const remindersWithClient = [];
      for (const reminder of reminders) {
        const client = reminder.client_id as unknown as ClientDocument;
        remindersWithClient.push({
          ...reminder.toObject(),
          client: client.name,
        });
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'Successfully retrieved all reminders',
          totalReminders: remindersWithClient.length,
        }),
      );

      return remindersWithClient;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Error retrieving reminders',
          error: error.message,
        }),
      );
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getReminderById(id: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'Fetching reminder by ID',
          id,
        }),
      );

      const reminder = await this.reminderModel.findById(id).populate([
        {
          path: 'client_id',
          model: Client.name,
          select: 'name point_of_contacts industry',
        },
        {
          path: 'order_id',
          model: Order.name,
          select: 'products agreements amc_start_date base_cost',
        },
        {
          path: 'amc_id',
          model: AMC.name,
        },
      ]);

      if (!reminder) {
        this.loggerService.error(
          JSON.stringify({
            message: 'Reminder not found',
            id,
          }),
        );
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

      this.loggerService.log(
        JSON.stringify({
          message: 'Successfully retrieved reminder',
          id,
        }),
      );

      return reminderObj;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Error retrieving reminder',
          error: error.message,
          id,
        }),
      );
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  async sendEmailToClient(data: SendEmailDto) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'Sending email to client',
          to: data.to,
          subject: data.subject,
        }),
      );

      const emailStatus = await this.mailService.sendMailWithoutTemplate({
        from: data.from,
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        html: data.body,
      });

      // creating reminder record
      const reminderId = `${data.from}-${data.to}-${data.email_template_id}`;
      const emailTemplate = await this.emailTemplateModel.findById(
        data.email_template_id,
      );

      const newReminder = new this.reminderModel({
        reminder_id: reminderId,
        to: data.to,
        from: data.from,
        subject: data.subject,
        template: emailTemplate.key as MAIL_TEMPLATES,
        email_template_id: data.email_template_id,
        context: data.body,
        status: emailStatus,
        total_attempts: 1,
        communication_type: COMMUNICATION_TYPE.EXTERNAL,
        body: data.body,
        customization_id: data.customization_id,
        license_id: data.license_id,
        order_id: data.order_id,
        amc_id: data.amc_id,
        client_id: data.client_id,
      });

      await newReminder.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'Email sent successfully',
          to: data.to,
          subject: data.subject,
          status: emailStatus,
        }),
      );

      return emailStatus;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Critical error in sendEmailToClient',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getEmailTemplates() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'Fetching email templates',
        }),
      );

      const templates = await this.emailTemplateModel.find();

      this.loggerService.log(
        JSON.stringify({
          message: 'Successfully retrieved email templates',
          totalTemplates: templates.length,
        }),
      );

      return templates;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Error retrieving email templates',
          error: error.message,
        }),
      );
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getExternalCommunicationHistory() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'Fetching external communication history',
        }),
      );

      const communications = await this.reminderModel
        .find({ communication_type: COMMUNICATION_TYPE.EXTERNAL })
        .populate([
          {
            path: 'client_id',
            model: Client.name,
            select: 'name point_of_contacts industry',
          },
          {
            path: 'order_id',
            model: Order.name,
            select: 'products agreements amc_start_date base_cost',
          },
          {
            path: 'amc_id',
            model: AMC.name,
          },
          {
            path: 'email_template_id',
            model: EmailTemplate.name,
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

      this.loggerService.log(
        JSON.stringify({
          message: 'Successfully retrieved external communication history',
          totalCommunications: communicationsWithClient.length,
        }),
      );

      return communicationsWithClient;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'Error retrieving external communication history',
          error: error.message,
        }),
      );
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
