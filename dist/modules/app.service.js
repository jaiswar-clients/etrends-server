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
    async uploadFile(file, fileName) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'uploadFile: Start uploading file',
                fileName,
            }));
            const filePath = await this.storageService.uploadFile(file, fileName);
            this.loggerService.log(JSON.stringify({
                message: 'uploadFile: Successfully uploaded file',
                fileName,
                filePath,
            }));
            return filePath;
        }
        catch (error) {
            console.log(error);
            this.loggerService.log(JSON.stringify({
                message: 'uploadFile: Error uploading file',
                fileName,
                error: error.message,
            }));
            throw new common_1.HttpException('Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
    async uploadFiles(files, fileNames) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'uploadFiles: Start uploading multiple files',
                fileNames,
            }));
            const filePaths = await Promise.all(files.map((file, index) => this.storageService.uploadFile(file, fileNames[index])));
            this.loggerService.log(JSON.stringify({
                message: 'uploadFiles: Successfully uploaded multiple files',
                fileNames,
                filePaths,
            }));
            return filePaths;
        }
        catch (error) {
            console.log(error);
            this.loggerService.log(JSON.stringify({
                message: 'uploadFiles: Error uploading multiple files',
                fileNames,
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