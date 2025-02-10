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
exports.AddAMCPaymentDto = exports.UpdateAMCPaymentDto = exports.UpdateAMCDto = void 0;
const amc_schema_1 = require("../../../db/schema/amc/amc.schema");
const class_validator_1 = require("class-validator");
class UpdateAMCDto {
}
exports.UpdateAMCDto = UpdateAMCDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], UpdateAMCDto.prototype, "payments", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateAMCDto.prototype, "start_date", void 0);
class UpdateAMCPaymentDto {
}
exports.UpdateAMCPaymentDto = UpdateAMCPaymentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], UpdateAMCPaymentDto.prototype, "from_date", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], UpdateAMCPaymentDto.prototype, "to_date", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(amc_schema_1.PAYMENT_STATUS_ENUM),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateAMCPaymentDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], UpdateAMCPaymentDto.prototype, "received_date", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateAMCPaymentDto.prototype, "purchase_order_number", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateAMCPaymentDto.prototype, "total_cost", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateAMCPaymentDto.prototype, "amc_rate_applied", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateAMCPaymentDto.prototype, "amc_rate_amount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateAMCPaymentDto.prototype, "purchase_order_document", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], UpdateAMCPaymentDto.prototype, "purchase_order_date", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateAMCPaymentDto.prototype, "invoice_document", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateAMCPaymentDto.prototype, "invoice_number", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], UpdateAMCPaymentDto.prototype, "invoice_date", void 0);
class AddAMCPaymentDto {
}
exports.AddAMCPaymentDto = AddAMCPaymentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], AddAMCPaymentDto.prototype, "from_date", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], AddAMCPaymentDto.prototype, "to_date", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(amc_schema_1.PAYMENT_STATUS_ENUM),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AddAMCPaymentDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], AddAMCPaymentDto.prototype, "received_date", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], AddAMCPaymentDto.prototype, "amc_rate_applied", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], AddAMCPaymentDto.prototype, "amc_rate_amount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AddAMCPaymentDto.prototype, "purchase_order_number", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AddAMCPaymentDto.prototype, "purchase_order_document", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], AddAMCPaymentDto.prototype, "purchase_order_date", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AddAMCPaymentDto.prototype, "invoice_document", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AddAMCPaymentDto.prototype, "invoice_number", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], AddAMCPaymentDto.prototype, "invoice_date", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], AddAMCPaymentDto.prototype, "total_cost", void 0);
//# sourceMappingURL=update-amc.dto.js.map