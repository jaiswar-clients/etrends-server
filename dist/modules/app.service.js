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
exports.AppService = void 0;
const logger_service_1 = require("../common/logger/services/logger.service");
const storage_service_1 = require("../common/storage/services/storage.service");
const common_1 = require("@nestjs/common");
let AppService = class AppService {
    constructor(storageService, loggerService) {
        this.storageService = storageService;
        this.loggerService = loggerService;
    }
    async getUrlForUpload(fileName) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getUrlForUpload: Start generating upload URL',
                fileName,
            }));
            const url = await this.storageService.generateUploadUrl(fileName);
            this.loggerService.log(JSON.stringify({
                message: 'getUrlForUpload: Successfully generated upload URL',
                fileName,
                url,
            }));
            return url;
        }
        catch (error) {
            this.loggerService.log(JSON.stringify({
                message: 'getUrlForUpload: Error generating upload URL',
                fileName,
                error: error.message,
            }));
            throw new common_1.HttpException('Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [storage_service_1.StorageService,
        logger_service_1.LoggerService])
], AppService);
//# sourceMappingURL=app.service.js.map