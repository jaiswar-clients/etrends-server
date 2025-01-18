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
exports.AdditionalServiceSchema = exports.AdditionalService = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongooseDelete = require("mongoose-delete");
const mongoose_2 = require("mongoose");
const product_order_schema_1 = require("./product-order.schema");
let AdditionalService = class AdditionalService extends mongoose_2.Document {
};
exports.AdditionalService = AdditionalService;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, required: true, ref: 'Product' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], AdditionalService.prototype, "product_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], AdditionalService.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            start: { type: Date, required: true },
            end: { type: Date, required: true },
        },
    }),
    __metadata("design:type", Object)
], AdditionalService.prototype, "date", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true }),
    __metadata("design:type", Number)
], AdditionalService.prototype, "cost", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: product_order_schema_1.PAYMENT_STATUS_ENUM,
        default: product_order_schema_1.PAYMENT_STATUS_ENUM.PENDING,
    }),
    __metadata("design:type", String)
], AdditionalService.prototype, "payment_status", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: Date,
        default: Date.now,
    }),
    __metadata("design:type", Date)
], AdditionalService.prototype, "purchased_date", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AdditionalService.prototype, "payment_receive_date", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], AdditionalService.prototype, "purchase_order_document", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], AdditionalService.prototype, "purchase_order_number", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], AdditionalService.prototype, "invoice_number", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AdditionalService.prototype, "invoice_date", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], AdditionalService.prototype, "invoice_document", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], AdditionalService.prototype, "service_document", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Order' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], AdditionalService.prototype, "order_id", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], AdditionalService.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], AdditionalService.prototype, "updatedAt", void 0);
exports.AdditionalService = AdditionalService = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], AdditionalService);
const AdditionalServiceSchema = mongoose_1.SchemaFactory.createForClass(AdditionalService);
exports.AdditionalServiceSchema = AdditionalServiceSchema;
AdditionalServiceSchema.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: 'all',
});
AdditionalServiceSchema.set('toObject', { virtuals: true });
AdditionalServiceSchema.set('toJSON', { virtuals: true });
//# sourceMappingURL=additional-service.schema.js.map