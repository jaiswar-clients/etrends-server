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
exports.UpdatePendingPaymentDto = void 0;
const class_validator_1 = require("class-validator");
const product_order_schema_1 = require("../../../db/schema/order/product-order.schema");
const class_transformer_1 = require("class-transformer");
class UpdatePendingPaymentDto {
}
exports.UpdatePendingPaymentDto = UpdatePendingPaymentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsEnum)(['amc', 'order', 'license', 'customization', 'additional_service']),
    __metadata("design:type", String)
], UpdatePendingPaymentDto.prototype, "type", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => (isNaN(value) ? value : Number(value))),
    (0, class_validator_1.ValidateIf)((_, value) => typeof value === 'number'),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.ValidateIf)((_, value) => typeof value === 'string'),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdatePendingPaymentDto.prototype, "payment_identifier", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(product_order_schema_1.PAYMENT_STATUS_ENUM),
    __metadata("design:type", String)
], UpdatePendingPaymentDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePendingPaymentDto.prototype, "payment_receive_date", void 0);
//# sourceMappingURL=update-pending-payment.js.map