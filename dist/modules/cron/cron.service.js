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
exports.TasksService = void 0;
const logger_service_1 = require("../../common/logger/services/logger.service");
const order_service_1 = require("../order/services/order.service");
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const reminder_service_1 = require("../reminder/services/reminder.service");
let TasksService = class TasksService {
    constructor(loggerService, orderService, reminderService) {
        this.loggerService = loggerService;
        this.orderService = orderService;
        this.reminderService = reminderService;
    }
    async updateAMCPayments() {
        try {
            this.loggerService.log('Starting daily AMC payment update cron job');
            await this.orderService.updateAMCPayments();
            this.loggerService.log('Successfully completed AMC payment update cron job');
        }
        catch (error) {
            this.loggerService.error('Error in AMC payment update cron job', JSON.stringify(error));
        }
    }
    async sendpendingAMCReminders() {
        try {
            this.loggerService.log('Starting daily AMC reminder cron job');
            await this.reminderService.checkAMCPendingPaymentsAndSendReminder();
            this.loggerService.log('Successfully completed AMC reminder cron job');
        }
        catch (error) {
            this.loggerService.error('Error in AMC reminder cron job', JSON.stringify(error));
        }
    }
    async sendUpcomingAMCReminders() {
        try {
            this.loggerService.log('Starting daily AMC reminder cron job');
            await this.reminderService.checkAMCUpcomingPaymentsAndSendReminder();
            this.loggerService.log('Successfully completed AMC reminder cron job');
        }
        catch (error) {
            this.loggerService.error('Error in AMC reminder cron job', JSON.stringify(error));
        }
    }
    async sentAgreementExpiryReminders() {
        try {
            this.loggerService.log('Starting daily agreement expiry reminder cron job');
            await this.reminderService.checkAgreementExpiryAndSendReminder();
            this.loggerService.log('Successfully completed agreement expiry reminder cron job');
        }
        catch (error) {
            console.log(error);
            this.loggerService.error('Error in agreement expiry reminder cron job', JSON.stringify(error));
        }
    }
};
exports.TasksService = TasksService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_1AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasksService.prototype, "updateAMCPayments", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_HOURS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasksService.prototype, "sendpendingAMCReminders", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_4_HOURS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasksService.prototype, "sendUpcomingAMCReminders", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_2AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasksService.prototype, "sentAgreementExpiryReminders", null);
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService,
        order_service_1.OrderService,
        reminder_service_1.ReminderService])
], TasksService);
//# sourceMappingURL=cron.service.js.map