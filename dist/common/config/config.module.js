"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigModule = void 0;
const config_1 = require("@nestjs/config");
const common_1 = require("@nestjs/common");
const variables_1 = require("./variables");
const config_validation_1 = require("./config.validation");
const config_service_1 = require("./services/config.service");
let ConfigModule = class ConfigModule {
};
exports.ConfigModule = ConfigModule;
exports.ConfigModule = ConfigModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                load: [variables_1.app],
                cache: true,
                expandVariables: true,
                isGlobal: true,
                validationSchema: config_validation_1.validationSchema,
            }),
        ],
        controllers: [],
        providers: [config_service_1.ConfigService, config_1.ConfigService],
        exports: [config_service_1.ConfigService],
    })
], ConfigModule);
//# sourceMappingURL=config.module.js.map