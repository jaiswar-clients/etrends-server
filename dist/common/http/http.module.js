"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpModule = exports.AXIOS_INSTANCE_TOKEN = void 0;
const axios_1 = require("axios");
const common_1 = require("@nestjs/common");
const axios_2 = require("@nestjs/axios");
const http_service_1 = require("./services/http.service");
exports.AXIOS_INSTANCE_TOKEN = 'AXIOS_INSTANCE_TOKEN';
let HttpModule = class HttpModule extends axios_2.HttpModule {
};
exports.HttpModule = HttpModule;
exports.HttpModule = HttpModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [axios_2.HttpModule],
        providers: [
            http_service_1.HttpService,
            {
                provide: exports.AXIOS_INSTANCE_TOKEN,
                useValue: axios_1.default,
            },
        ],
        exports: [http_service_1.HttpService],
    })
], HttpModule);
//# sourceMappingURL=http.module.js.map