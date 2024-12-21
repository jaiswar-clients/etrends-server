"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailModule = void 0;
const mailer_1 = require("@nestjs-modules/mailer");
const pug_adapter_1 = require("@nestjs-modules/mailer/dist/adapters/pug.adapter");
const common_1 = require("@nestjs/common");
const mail_service_1 = require("./service/mail.service");
const path_1 = require("path");
const config_service_1 = require("../config/services/config.service");
let MailModule = class MailModule {
};
exports.MailModule = MailModule;
exports.MailModule = MailModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mailer_1.MailerModule.forRootAsync({
                useFactory: (configService) => ({
                    transport: {
                        host: configService.get('EMAIL_DOMAIN'),
                        port: configService.get('EMAIL_PORT'),
                        secureConnection: false,
                        auth: {
                            user: configService.get('EMAIL_ID'),
                            pass: configService.get('EMAIL_PASSWORD'),
                        },
                        tls: {
                            ciphers: 'SSLv3'
                        }
                    },
                    defaults: {
                        from: `"No Reply" <${configService.get('EMAIL_ID')}>`,
                    },
                    template: {
                        dir: (0, path_1.join)(__dirname, 'templates'),
                        adapter: new pug_adapter_1.PugAdapter(),
                        options: {
                            strict: true,
                        },
                    },
                }),
                inject: [config_service_1.ConfigService],
            }),
        ],
        providers: [mail_service_1.MailService],
        exports: [mail_service_1.MailService],
    })
], MailModule);
//# sourceMappingURL=mail.module.js.map