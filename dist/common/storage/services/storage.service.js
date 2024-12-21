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
const cloudfront_signer_1 = require("@aws-sdk/cloudfront-signer");
const common_1 = require("@nestjs/common");
const aws_sdk_1 = require("aws-sdk");
let StorageService = class StorageService {
    constructor(configService, loggerService) {
        this.configService = configService;
        this.loggerService = loggerService;
        this.s3 = new aws_sdk_1.S3();
    }
    get(filename) {
        if (!filename)
            return;
        const fileUrl = `${this.configService.get('AWS_CLOUDFRONT_DISTRIBUTION')}/${filename}`;
        const preSignedUrl = (0, cloudfront_signer_1.getSignedUrl)({
            url: fileUrl,
            dateLessThan: new Date(Date.now() + 1000 * 60 * 60 * 24).toString(),
            keyPairId: this.configService.get('AWS_CLOUDFRONT_KEY_PAIR'),
            privateKey: this.configService.get('AWS_CLOUDFRONT_PRIVATE_KEY'),
        });
        this.loggerService.log(`Retrieved file URL: ${preSignedUrl}`, 'StorageService');
        return preSignedUrl;
    }
    async generateUploadUrl(fileName) {
        const params = {
            Bucket: this.configService.get('AWS_BUCKET_NAME'),
            Key: fileName,
            Expires: 3600,
        };
        const uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);
        return uploadUrl;
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        logger_service_1.LoggerService])
], StorageService);
//# sourceMappingURL=storage.service.js.map