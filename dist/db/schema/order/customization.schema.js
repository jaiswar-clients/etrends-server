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
exports.CustomizationSchema = exports.Customization = exports.CustomizationType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const mongooseDelete = require("mongoose-delete");
const product_order_schema_1 = require("./product-order.schema");
var CustomizationType;
(function (CustomizationType) {
    CustomizationType["MODULE"] = "module";
    CustomizationType["REPORT"] = "report";
    CustomizationType["CUSTOMIZATION"] = "customization";
})(CustomizationType || (exports.CustomizationType = CustomizationType = {}));
let Customization = class Customization extends mongoose_2.Document {
};
exports.Customization = Customization;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, required: true, ref: 'Product' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Customization.prototype, "product_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Order' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Customization.prototype, "order_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], Customization.prototype, "cost", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String] }),
    __metadata("design:type", Array)
], Customization.prototype, "modules", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String] }),
    __metadata("design:type", Array)
], Customization.prototype, "reports", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Customization.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: CustomizationType }),
    __metadata("design:type", String)
], Customization.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Customization.prototype, "purchased_date", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: product_order_schema_1.PAYMENT_STATUS_ENUM,
        default: product_order_schema_1.PAYMENT_STATUS_ENUM.PENDING,
    }),
    __metadata("design:type", String)
], Customization.prototype, "payment_status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Customization.prototype, "payment_receive_date", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Customization.prototype, "purchase_order_document", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Customization.prototype, "invoice_document", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Customization.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Customization.prototype, "updatedAt", void 0);
exports.Customization = Customization = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Customization);
const CustomizationSchema = mongoose_1.SchemaFactory.createForClass(Customization);
exports.CustomizationSchema = CustomizationSchema;
CustomizationSchema.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: 'all',
});
CustomizationSchema.set('toObject', { virtuals: true });
CustomizationSchema.set('toJSON', { virtuals: true });
//# sourceMappingURL=customization.schema.js.map