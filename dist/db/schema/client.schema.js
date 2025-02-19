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
exports.ClientSchema = exports.Client = void 0;
const industry_enum_1 = require("../../common/types/enums/industry.enum");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const mongooseDelete = require("mongoose-delete");
class PointOfContact {
}
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], PointOfContact.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], PointOfContact.prototype, "email", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], PointOfContact.prototype, "designation", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], PointOfContact.prototype, "phone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], PointOfContact.prototype, "opt_for_email_reminder", void 0);
let Client = class Client extends mongoose_2.Document {
};
exports.Client = Client;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], Client.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Client' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Client.prototype, "parent_company_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Client.prototype, "pan_number", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Client.prototype, "gst_number", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Client.prototype, "address", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: industry_enum_1.INDUSTRIES_ENUM }),
    __metadata("design:type", String)
], Client.prototype, "industry", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Client.prototype, "client_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        type: Number,
        default: 12,
        enum: [1, 3, 6, 12, 18, 24],
    }),
    __metadata("design:type", Number)
], Client.prototype, "amc_frequency_in_months", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Client.prototype, "vendor_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], Client.prototype, "is_parent_company", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                type: mongoose_2.Types.ObjectId,
                ref: 'Client',
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], Client.prototype, "child_companies", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [PointOfContact], default: [] }),
    __metadata("design:type", Array)
], Client.prototype, "point_of_contacts", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                type: mongoose_2.Types.ObjectId,
                ref: 'Order',
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], Client.prototype, "orders", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: '' }),
    __metadata("design:type", String)
], Client.prototype, "remark", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                type: mongoose_2.Types.ObjectId,
                ref: 'AMC',
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], Client.prototype, "amcs", void 0);
exports.Client = Client = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Client);
const ClientSchema = mongoose_1.SchemaFactory.createForClass(Client);
exports.ClientSchema = ClientSchema;
ClientSchema.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: 'all',
});
ClientSchema.set('toObject', { virtuals: true });
ClientSchema.set('toJSON', { virtuals: true });
//# sourceMappingURL=client.schema.js.map