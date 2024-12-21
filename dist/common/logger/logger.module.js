"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerModule = void 0;
const config_service_1 = require("../config/services/config.service");
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const pino_pretty_1 = require("pino-pretty");
const logger_service_1 = require("./services/logger.service");
const stream = (0, pino_pretty_1.default)({
    colorize: true,
    levelFirst: true,
    translateTime: 'SYS:standard',
    ignore: 'pid',
});
let LoggerModule = class LoggerModule {
};
exports.LoggerModule = LoggerModule;
exports.LoggerModule = LoggerModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            nestjs_pino_1.LoggerModule.forRootAsync({
                useFactory: async (configService) => ({
                    pinoHttp: [
                        {
                            name: 'CE API',
                            level: 'trace',
                            transport: {
                                target: 'pino-pretty',
                            },
                            redact: ['req.headers', 'res.headers'],
                            useLevel: 'trace',
                        },
                        !configService.IS_PRODUCTION ? stream : undefined,
                    ],
                }),
                inject: [config_service_1.ConfigService],
            }),
        ],
        providers: [logger_service_1.LoggerService],
        exports: [logger_service_1.LoggerService],
    })
], LoggerModule);
//# sourceMappingURL=logger.module.js.map