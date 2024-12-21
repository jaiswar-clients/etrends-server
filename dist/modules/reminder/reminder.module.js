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
exports.ReminderModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const product_order_schema_1 = require("../../db/schema/order/product-order.schema");
const amc_schema_1 = require("../../db/schema/amc/amc.schema");
const mail_service_1 = require("../../common/mail/service/mail.service");
const reminder_schema_1 = require("../../db/schema/reminder.schema");
const reminder_controller_1 = require("./controller/reminder.controller");
const reminder_service_1 = require("./services/reminder.service");
const storage_module_1 = require("../../common/storage/storage.module");
let ReminderModule = class ReminderModule {
    constructor(reminderService) {
        this.reminderService = reminderService;
    }
    async onModuleInit() {
    }
};
exports.ReminderModule = ReminderModule;
exports.ReminderModule = ReminderModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: product_order_schema_1.Order.name, schema: product_order_schema_1.OrderSchema },
                { name: amc_schema_1.AMC.name, schema: amc_schema_1.AMCSchema },
                { name: reminder_schema_1.Reminder.name, schema: reminder_schema_1.ReminderSchema },
            ]),
            storage_module_1.StorageModule,
        ],
        controllers: [reminder_controller_1.ReminderController],
        providers: [reminder_service_1.ReminderService, mail_service_1.MailService],
        exports: [reminder_service_1.ReminderService],
    }),
    __metadata("design:paramtypes", [reminder_service_1.ReminderService])
], ReminderModule);
//# sourceMappingURL=reminder.module.js.map