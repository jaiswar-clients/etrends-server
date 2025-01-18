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
exports.CreateCustomizationDto = void 0;
const mongoose_1 = require("mongoose");
const customization_schema_1 = require("../../../db/schema/order/customization.schema");
const class_validator_1 = require("class-validator");
const product_order_schema_1 = require("../../../db/schema/order/product-order.schema");
class CreateCustomizationDto {
}
exports.CreateCustomizationDto = CreateCustomizationDto;
__decorate([
    (0, class_validator_1.IsMongoId)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", mongoose_1.Types.ObjectId)
], CreateCustomizationDto.prototype, "product_id", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], CreateCustomizationDto.prototype, "cost", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(product_order_schema_1.PAYMENT_STATUS_ENUM),
    __metadata("design:type", String)
], CreateCustomizationDto.prototype, "payment_status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], CreateCustomizationDto.prototype, "payment_receive_date", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateCustomizationDto.prototype, "modules", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCustomizationDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCustomizationDto.prototype, "purchase_order_document", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCustomizationDto.prototype, "purchase_order_number", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCustomizationDto.prototype, "invoice_number", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateCustomizationDto.prototype, "invoice_date", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCustomizationDto.prototype, "invoice_document", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCustomizationDto.prototype, "purchased_date", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(customization_schema_1.CustomizationType),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCustomizationDto.prototype, "type", void 0);
//# sourceMappingURL=create-customization.service.dto.js.map