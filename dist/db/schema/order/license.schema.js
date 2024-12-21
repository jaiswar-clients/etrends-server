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
exports.LicenseSchema = exports.License = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const mongooseDelete = require("mongoose-delete");
let License = class License extends mongoose_2.Document {
};
exports.License = License;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, required: true, ref: 'Product' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], License.prototype, "product_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Order' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], License.prototype, "order_id", void 0);
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
], License.prototype, "rate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], License.prototype, "total_license", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], License.prototype, "purchase_date", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], License.prototype, "purchase_order_document", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], License.prototype, "invoice", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], License.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], License.prototype, "updatedAt", void 0);
exports.License = License = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], License);
const LicenseSchema = mongoose_1.SchemaFactory.createForClass(License);
exports.LicenseSchema = LicenseSchema;
LicenseSchema.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: 'all',
});
LicenseSchema.set('toObject', { virtuals: true });
LicenseSchema.set('toJSON', { virtuals: true });
//# sourceMappingURL=license.schema.js.map