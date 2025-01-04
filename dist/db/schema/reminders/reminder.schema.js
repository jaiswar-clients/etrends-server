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
exports.ReminderSchema = exports.Reminder = exports.COMMUNICATION_TYPE = void 0;
const mail_service_1 = require("../../../common/mail/service/mail.service");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const mongooseDelete = require("mongoose-delete");
var COMMUNICATION_TYPE;
(function (COMMUNICATION_TYPE) {
    COMMUNICATION_TYPE["INTERNAL"] = "internal";
    COMMUNICATION_TYPE["EXTERNAL"] = "external";
})(COMMUNICATION_TYPE || (exports.COMMUNICATION_TYPE = COMMUNICATION_TYPE = {}));
let Reminder = class Reminder extends mongoose_2.Document {
};
exports.Reminder = Reminder;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], Reminder.prototype, "from", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], Reminder.prototype, "to", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], Reminder.prototype, "subject", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: mail_service_1.MAIL_TEMPLATES }),
    __metadata("design:type", String)
], Reminder.prototype, "template", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, required: true, default: {} }),
    __metadata("design:type", Object)
], Reminder.prototype, "context", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Reminder.prototype, "body", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Schema.Types.ObjectId, ref: 'EmailTemplate' }),
    __metadata("design:type", String)
], Reminder.prototype, "email_template_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        default: COMMUNICATION_TYPE.INTERNAL,
        enum: COMMUNICATION_TYPE,
    }),
    __metadata("design:type", String)
], Reminder.prototype, "communication_type", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        default: 'sent',
        enum: ['sent', 'failed'],
    }),
    __metadata("design:type", String)
], Reminder.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Schema.Types.ObjectId, ref: 'Client' }),
    __metadata("design:type", String)
], Reminder.prototype, "client_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Schema.Types.ObjectId, ref: 'Order' }),
    __metadata("design:type", String)
], Reminder.prototype, "order_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Schema.Types.ObjectId, ref: 'Amc' }),
    __metadata("design:type", String)
], Reminder.prototype, "amc_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Schema.Types.ObjectId, ref: 'License' }),
    __metadata("design:type", String)
], Reminder.prototype, "license_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Schema.Types.ObjectId, ref: 'Customization' }),
    __metadata("design:type", String)
], Reminder.prototype, "customization_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], Reminder.prototype, "reminder_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 1 }),
    __metadata("design:type", Number)
], Reminder.prototype, "total_attempts", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                filename: String,
                url: String,
                content_type: String,
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], Reminder.prototype, "attachments", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Reminder.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Reminder.prototype, "updatedAt", void 0);
exports.Reminder = Reminder = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Reminder);
const ReminderSchema = mongoose_1.SchemaFactory.createForClass(Reminder);
exports.ReminderSchema = ReminderSchema;
ReminderSchema.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: 'all',
});
ReminderSchema.set('toObject', { virtuals: true });
ReminderSchema.set('toJSON', { virtuals: true });
//# sourceMappingURL=reminder.schema.js.map