"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./modules/app.module");
const config_service_1 = require("./common/config/services/config.service");
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const helmet_1 = require("helmet");
const response_interceptor_1 = require("./interceptors/response.interceptor");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const express = require("express");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bufferLogs: true,
        cors: true,
        rawBody: true,
    });
    const configService = app.get(config_service_1.ConfigService);
    const port = configService.get('PORT');
    const filesPath = configService.get('FILES_PATH');
    app.enableVersioning({
        type: common_1.VersioningType.URI,
        defaultVersion: '1',
    });
    const reflector = new core_1.Reflector();
    app.useLogger(app.get(nestjs_pino_1.Logger));
    app.use((0, helmet_1.default)());
    app.useBodyParser('text');
    app.useGlobalInterceptors(new response_interceptor_1.ResponseInterceptor(reflector));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionInterceptor());
    app.use('/v1/files', express.static(filesPath));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        forbidUnknownValues: true,
    }));
    await app.listen(port);
}
bootstrap();
//# sourceMappingURL=main.js.map