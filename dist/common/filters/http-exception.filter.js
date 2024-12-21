"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionInterceptor = void 0;
const common_1 = require("@nestjs/common");
let HttpExceptionInterceptor = class HttpExceptionInterceptor {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const status = exception instanceof common_1.HttpException
            ? exception.getStatus()
            : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const message = exception instanceof common_1.HttpException ? exception.getResponse() : exception;
        response.status(status).json({
            message: message['message'] || message || 'Internal server error',
            data: null,
            success: false,
        });
    }
};
exports.HttpExceptionInterceptor = HttpExceptionInterceptor;
exports.HttpExceptionInterceptor = HttpExceptionInterceptor = __decorate([
    (0, common_1.Catch)()
], HttpExceptionInterceptor);
//# sourceMappingURL=http-exception.filter.js.map