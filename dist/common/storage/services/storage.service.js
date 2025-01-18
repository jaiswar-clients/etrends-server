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
exports.StorageService = void 0;
const config_service_1 = require("../../config/services/config.service");
const logger_service_1 = require("../../logger/services/logger.service");
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path = require("path");
let StorageService = class StorageService {
    constructor(configService, loggerService) {
        this.configService = configService;
        this.loggerService = loggerService;
        this.filesPath = this.configService.get('FILES_PATH');
        if (!fs.existsSync(this.filesPath)) {
            fs.mkdirSync(this.filesPath, { recursive: true });
        }
    }
    get(filename) {
        if (!filename) {
            return null;
        }
        const filePath = path.join(this.filesPath, filename);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        return `${this.configService.get('APP_URL')}/v1/files/${filename}`;
    }
    async uploadFile(file, fileName) {
        if (!fileName) {
            throw new common_1.BadRequestException('Filename is required');
        }
        if (!file) {
            throw new common_1.BadRequestException('File is required');
        }
        try {
            const filePath = path.join(this.filesPath, fileName);
            await fs.promises.writeFile(filePath, file.buffer);
            this.loggerService.log(`File uploaded successfully: ${filePath}`, 'StorageService');
            return fileName;
        }
        catch (error) {
            this.loggerService.error(`Error uploading file: ${error.message}`, error.stack, 'StorageService');
            throw error;
        }
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        logger_service_1.LoggerService])
], StorageService);
//# sourceMappingURL=storage.service.js.map