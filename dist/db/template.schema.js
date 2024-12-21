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
exports.EntitySchema = exports.Entity = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const mongooseDelete = require("mongoose-delete");
let Entity = class Entity extends mongoose_2.Document {
};
exports.Entity = Entity;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], Entity.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Entity.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Entity.prototype, "updatedAt", void 0);
exports.Entity = Entity = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Entity);
const EntitySchema = mongoose_1.SchemaFactory.createForClass(Entity);
exports.EntitySchema = EntitySchema;
EntitySchema.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: 'all',
});
EntitySchema.set('toObject', { virtuals: true });
EntitySchema.set('toJSON', { virtuals: true });
//# sourceMappingURL=template.schema.js.map