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
exports.AMCSchema = exports.AMC = exports.PAYMENT_STATUS_ENUM = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const mongooseDelete = require("mongoose-delete");
var PAYMENT_STATUS_ENUM;
(function (PAYMENT_STATUS_ENUM) {
    PAYMENT_STATUS_ENUM["PAID"] = "paid";
    PAYMENT_STATUS_ENUM["PENDING"] = "pending";
    PAYMENT_STATUS_ENUM["PARTIAL"] = "partial";
})(PAYMENT_STATUS_ENUM || (exports.PAYMENT_STATUS_ENUM = PAYMENT_STATUS_ENUM = {}));
let AMC = class AMC extends mongoose_2.Document {
};
exports.AMC = AMC;
__decorate([
    (0, mongoose_1.Prop)({ required: true, ref: 'Order', type: mongoose_2.Schema.Types.ObjectId }),
    __metadata("design:type", mongoose_2.Schema.Types.ObjectId)
], AMC.prototype, "order_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, ref: 'Client', type: mongoose_2.Schema.Types.ObjectId }),
    __metadata("design:type", mongoose_2.Schema.Types.ObjectId)
], AMC.prototype, "client_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: Number }),
    __metadata("design:type", Number)
], AMC.prototype, "total_cost", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], AMC.prototype, "purchase_order_number", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AMC.prototype, "start_date", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                from_date: { type: Date, required: true },
                to_date: { type: Date, required: true },
                status: {
                    type: String,
                    enum: Object.values(PAYMENT_STATUS_ENUM),
                    required: true,
                },
                received_date: { type: Date, required: true },
            },
        ],
    }),
    __metadata("design:type", Array)
], AMC.prototype, "payments", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], AMC.prototype, "purchase_order_document", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], AMC.prototype, "invoice_document", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: Number }),
    __metadata("design:type", Number)
], AMC.prototype, "amount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], AMC.prototype, "amc_percentage", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                type: mongoose_2.Schema.Types.ObjectId,
                ref: 'Product',
            },
        ],
    }),
    __metadata("design:type", Array)
], AMC.prototype, "products", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AMC.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AMC.prototype, "updatedAt", void 0);
exports.AMC = AMC = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], AMC);
const AMCSchema = mongoose_1.SchemaFactory.createForClass(AMC);
exports.AMCSchema = AMCSchema;
AMCSchema.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: 'all',
});
AMCSchema.set('toObject', { virtuals: true });
AMCSchema.set('toJSON', { virtuals: true });
//# sourceMappingURL=amc.schema.js.map