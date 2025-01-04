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
exports.EmailTemplateSchema = exports.EmailTemplate = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const mongooseDelete = require("mongoose-delete");
let EmailTemplate = class EmailTemplate extends mongoose_2.Document {
};
exports.EmailTemplate = EmailTemplate;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], EmailTemplate.prototype, "key", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], EmailTemplate.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], EmailTemplate.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                _id: { type: mongoose_2.Schema.Types.ObjectId, auto: true },
                key: String,
                field: String,
            },
        ],
        required: true,
    }),
    __metadata("design:type", Array)
], EmailTemplate.prototype, "dynamic_variables", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], EmailTemplate.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], EmailTemplate.prototype, "updatedAt", void 0);
exports.EmailTemplate = EmailTemplate = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], EmailTemplate);
const EmailTemplateSchema = mongoose_1.SchemaFactory.createForClass(EmailTemplate);
exports.EmailTemplateSchema = EmailTemplateSchema;
EmailTemplateSchema.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: 'all',
});
EmailTemplateSchema.set('toObject', { virtuals: true });
EmailTemplateSchema.set('toJSON', { virtuals: true });
//# sourceMappingURL=email.template.schema.js.map