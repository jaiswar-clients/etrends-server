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
exports.OrderSchema = exports.Order = exports.PAYMENT_STATUS_ENUM = void 0;
const order_enum_1 = require("../../../common/types/enums/order.enum");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const mongooseDelete = require("mongoose-delete");
var PAYMENT_STATUS_ENUM;
(function (PAYMENT_STATUS_ENUM) {
    PAYMENT_STATUS_ENUM["PAID"] = "paid";
    PAYMENT_STATUS_ENUM["PENDING"] = "pending";
})(PAYMENT_STATUS_ENUM || (exports.PAYMENT_STATUS_ENUM = PAYMENT_STATUS_ENUM = {}));
class PaymentTerms {
}
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], PaymentTerms.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", Number)
], PaymentTerms.prototype, "percentage_from_base_cost", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], PaymentTerms.prototype, "calculated_amount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], PaymentTerms.prototype, "invoice_document", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], PaymentTerms.prototype, "invoice_number", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], PaymentTerms.prototype, "invoice_date", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: PAYMENT_STATUS_ENUM,
        default: PAYMENT_STATUS_ENUM.PENDING,
    }),
    __metadata("design:type", String)
], PaymentTerms.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], PaymentTerms.prototype, "payment_receive_date", void 0);
let Order = class Order extends mongoose_2.Document {
};
exports.Order = Order;
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                type: mongoose_2.Types.ObjectId,
                ref: 'Product',
            },
        ],
        required: true,
    }),
    __metadata("design:type", Array)
], Order.prototype, "products", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Client' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Order.prototype, "client_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], Order.prototype, "base_cost", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                product_id: { type: mongoose_2.Types.ObjectId, ref: 'Product' },
                amount: Number,
                percentage: Number,
            },
        ],
        default: {},
    }),
    __metadata("design:type", Array)
], Order.prototype, "base_cost_seperation", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            percentage: {
                type: Number,
                max: 100,
                default: 20,
            },
            amount: Number,
        },
    }),
    __metadata("design:type", Object)
], Order.prototype, "amc_rate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'AMC' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Order.prototype, "amc_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: order_enum_1.ORDER_STATUS_ENUM }),
    __metadata("design:type", String)
], Order.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], Order.prototype, "licenses_with_base_price", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], Order.prototype, "cost_per_license", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [PaymentTerms] }),
    __metadata("design:type", Array)
], Order.prototype, "payment_terms", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'License' }] }),
    __metadata("design:type", Array)
], Order.prototype, "licenses", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], Order.prototype, "training_and_implementation_cost", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                start: Date,
                end: Date,
                document: String,
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], Order.prototype, "agreements", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Order.prototype, "purchase_order_document", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Order.prototype, "purchase_order_number", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: Date.now }),
    __metadata("design:type", Date)
], Order.prototype, "purchased_date", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                title: String,
                url: String,
            },
        ],
        default: {},
    }),
    __metadata("design:type", Array)
], Order.prototype, "other_documents", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'Customization' }] }),
    __metadata("design:type", Array)
], Order.prototype, "customizations", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], Order.prototype, "amc_rate_change_frequency_in_years", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'Additional' }] }),
    __metadata("design:type", Array)
], Order.prototype, "additional_services", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Order.prototype, "amc_start_date", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Order.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Order.prototype, "updatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            customization: Boolean,
            license: Boolean,
        },
        default: {
            customization: false,
            license: false,
        },
    }),
    __metadata("design:type", Object)
], Order.prototype, "is_purchased_with_order", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                from: String,
                to: String,
                date: Date,
                user: mongoose_2.Types.ObjectId,
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], Order.prototype, "status_logs", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                percentage: Number,
                amount: Number,
                date: Date,
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], Order.prototype, "amc_rate_history", void 0);
exports.Order = Order = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Order);
const OrderSchema = mongoose_1.SchemaFactory.createForClass(Order);
exports.OrderSchema = OrderSchema;
OrderSchema.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: 'all',
});
OrderSchema.set('toObject', { virtuals: true });
OrderSchema.set('toJSON', { virtuals: true });
//# sourceMappingURL=product-order.schema.js.map