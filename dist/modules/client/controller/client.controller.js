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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientController = void 0;
const common_1 = require("@nestjs/common");
const client_service_1 = require("../services/client.service");
const create_client_dto_1 = require("../dto/create-client.dto");
const auth_guard_1 = require("../../../common/guards/auth.guard");
let ClientController = class ClientController {
    constructor(clientService) {
        this.clientService = clientService;
    }
    async getAllClients(page, limit, all) {
        const parsedPage = parseInt(page, 10);
        const parsedLimit = parseInt(limit, 10);
        const fetchAll = Boolean(all);
        return this.clientService.getAllClients(parsedPage, parsedLimit, fetchAll);
    }
    async generateClientId() {
        return this.clientService.generateUniqueClientId();
    }
    async getAllParentCompanies() {
        return this.clientService.getAllParentCompanies();
    }
    async getProductsPurchasedByClient(clientId) {
        return this.clientService.getProductsPurchasedByClient(clientId);
    }
    async getProfitByClient(clientId) {
        return this.clientService.getProfitFromClient(clientId);
    }
    async getClientById(id) {
        return this.clientService.getClientById(id);
    }
    async createNewClient(body) {
        return this.clientService.createClient(body);
    }
    async updateClient(dbClientId, body) {
        return this.clientService.updateClient(dbClientId, body);
    }
};
exports.ClientController = ClientController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('all')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "getAllClients", null);
__decorate([
    (0, common_1.Get)('/generate-client-id'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "generateClientId", null);
__decorate([
    (0, common_1.Get)('/parent-companies'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "getAllParentCompanies", null);
__decorate([
    (0, common_1.Get)('/:id/products'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "getProductsPurchasedByClient", null);
__decorate([
    (0, common_1.Get)('/:id/profit'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "getProfitByClient", null);
__decorate([
    (0, common_1.Get)('/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "getClientById", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_client_dto_1.CreateNewClientDto]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "createNewClient", null);
__decorate([
    (0, common_1.Patch)('/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_client_dto_1.CreateNewClientDto]),
    __metadata("design:returntype", Promise)
], ClientController.prototype, "updateClient", null);
exports.ClientController = ClientController = __decorate([
    (0, common_1.Controller)('clients'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [client_service_1.ClientService])
], ClientController);
//# sourceMappingURL=client.controller.js.map