"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const logger_module_1 = require("../common/logger/logger.module");
const http_module_1 = require("../common/http/http.module");
const config_module_1 = require("../common/config/config.module");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const config_service_1 = require("../common/config/services/config.service");
const user_module_1 = require("./user/user.module");
const client_module_1 = require("./client/client.module");
const order_module_1 = require("./order/order.module");
const jwt_1 = require("@nestjs/jwt");
const storage_module_1 = require("../common/storage/storage.module");
const product_module_1 = require("./product/product.module");
const schedule_1 = require("@nestjs/schedule");
const cron_service_1 = require("./cron/cron.service");
const mail_module_1 = require("../common/mail/mail.module");
const reminder_module_1 = require("./reminder/reminder.module");
const report_module_1 = require("./report/report.module");
const appModules = [logger_module_1.LoggerModule, http_module_1.HttpModule, config_module_1.ConfigModule];
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            ...appModules,
            mongoose_1.MongooseModule.forRootAsync({
                inject: [config_service_1.ConfigService],
                useFactory: (config) => ({
                    uri: config.get('DATABASE_URL'),
                }),
            }),
            jwt_1.JwtModule.registerAsync({
                global: true,
                inject: [config_service_1.ConfigService],
                useFactory: (configService) => ({
                    global: true,
                    secret: configService.get('JWT_SECRET'),
                }),
            }),
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
            }),
            schedule_1.ScheduleModule.forRoot(),
            user_module_1.UserModule,
            client_module_1.ClientModule,
            order_module_1.OrderModule,
            storage_module_1.StorageModule,
            product_module_1.ProductModule,
            mail_module_1.MailModule,
            reminder_module_1.ReminderModule,
            report_module_1.ReportModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService, cron_service_1.TasksService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map