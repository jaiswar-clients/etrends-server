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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const platform_express_1 = require("@nestjs/platform-express");
const class_validator_1 = require("class-validator");
class UploadFileDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UploadFileDto.prototype, "filename", void 0);
class UploadMultipleFilesDto {
}
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Array)
], UploadMultipleFilesDto.prototype, "filenames", void 0);
let AppController = class AppController {
    constructor(appService) {
        this.appService = appService;
    }
    async uploadFile(file, body) {
        if (!file) {
            throw new common_1.BadRequestException('File is required');
        }
        return this.appService.uploadFile(file, body.filename);
    }
    async uploadMultipleFiles(files, body) {
        return this.appService.uploadFiles(files, body.filenames);
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Post)('/upload'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UploadFileDto]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Post)('/upload-multiple'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('files')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, UploadMultipleFilesDto]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "uploadMultipleFiles", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService])
], AppController);
//# sourceMappingURL=app.controller.js.map