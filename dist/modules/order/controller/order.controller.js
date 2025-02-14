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
exports.OrderController = void 0;
const common_1 = require("@nestjs/common");
const order_service_1 = require("../services/order.service");
const create_order_dto_1 = require("../dto/create-order.dto");
const create_license_dto_1 = require("../dto/create-license.dto");
const create_additional_service_dto_1 = require("../dto/create-additional-service.dto");
const create_customization_service_dto_1 = require("../dto/create-customization.service.dto");
const update_amc_dto_1 = require("../dto/update-amc.dto");
const order_enum_1 = require("../../../common/types/enums/order.enum");
const auth_guard_1 = require("../../../common/guards/auth.guard");
const update_pending_payment_1 = require("../dto/update-pending-payment");
let OrderController = class OrderController {
    constructor(orderService) {
        this.orderService = orderService;
    }
    async loadAllOrdersWithAttributes(page, limit) {
        const parsedPage = parseInt(page.toString());
        const parsedLimit = parseInt(limit.toString());
        return this.orderService.loadAllOrdersWithAttributes(parsedPage, parsedLimit);
    }
    async loadAllAMC(page, limit, filter, upcoming, startDate, endDate) {
        const parsedPage = Math.max(1, parseInt(page?.toString() || '1'));
        const parsedLimit = Math.min(100, Math.max(1, parseInt(limit?.toString() || '10')));
        const parsedUpcoming = Math.max(1, parseInt(upcoming?.toString() || '1'));
        let parsedStartDate = undefined;
        let parsedEndDate = undefined;
        if (startDate !== 'undefined') {
            parsedStartDate = new Date(startDate);
            if (isNaN(parsedStartDate.getTime())) {
                throw new common_1.HttpException('Invalid start date format', common_1.HttpStatus.BAD_REQUEST);
            }
        }
        if (endDate !== 'undefined') {
            parsedEndDate = new Date(endDate);
            if (isNaN(parsedEndDate.getTime())) {
                throw new common_1.HttpException('Invalid end date format', common_1.HttpStatus.BAD_REQUEST);
            }
        }
        if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
            throw new common_1.HttpException('Start date cannot be after end date', common_1.HttpStatus.BAD_REQUEST);
        }
        if (filter && !Object.values(order_enum_1.AMC_FILTER).includes(filter)) {
            throw new common_1.HttpException('Invalid filter value', common_1.HttpStatus.BAD_REQUEST);
        }
        return this.orderService.loadAllAMC(parsedPage, parsedLimit, filter || order_enum_1.AMC_FILTER.UPCOMING, {
            upcoming: parsedUpcoming,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
        });
    }
    async getAllPendingPayments(page, limit) {
        const parsedPage = parseInt(page.toString());
        const parsedLimit = parseInt(limit.toString());
        return this.orderService.getAllPendingPayments(parsedPage, parsedLimit);
    }
    async getOrderById(orderId) {
        return this.orderService.getOrderById(orderId);
    }
    async getAMCByOrderId(orderId) {
        return this.orderService.getAmcByOrderId(orderId);
    }
    async getOrdersByClientId(clientId) {
        return this.orderService.getOrdersByClientId(clientId);
    }
    async getLicenseById(orderId) {
        return this.orderService.getLicenseById(orderId);
    }
    async getAdditionalServiceById(orderId) {
        return this.orderService.getAdditionalServiceById(orderId);
    }
    async getCustomizationById(orderId) {
        return this.orderService.getCustomizationById(orderId);
    }
    async getAmcReviewByOrderId(orderId) {
        return this.orderService.getAmcReviewByOrderId(orderId);
    }
    async createOrder(clientId, body) {
        return this.orderService.createOrder(clientId, body);
    }
    async updateOrder(id, body) {
        return this.orderService.updateOrder(id, body);
    }
    async addLicense(orderId, body) {
        return this.orderService.addLicense(orderId, body);
    }
    async addAdditionalService(orderId, body) {
        return this.orderService.addAdditionalService(orderId, body);
    }
    async addCustomization(orderId, body) {
        return this.orderService.addCustomization(orderId, body);
    }
    async updateCustomizationById(id, body) {
        return this.orderService.updateCustomizationById(id, body);
    }
    async updateLicenseById(id, body) {
        return this.orderService.updateLicenseById(id, body);
    }
    async updateAdditionalServiceById(id, body) {
        return this.orderService.updateAdditionalServiceById(id, body);
    }
    async updateAMCById(id, body) {
        return this.orderService.updateAMCById(id, body);
    }
    async addPaymentsIntoAMC(amcId, body) {
        return this.orderService.addPaymentsIntoAmc(amcId, body);
    }
    async updateAMCPaymentById(id, paymentId, body) {
        return this.orderService.updateAmcPaymentById(id, paymentId, body);
    }
    async updatePendingPaymentStatus(id, body) {
        return this.orderService.updatePendingPayment(id, body.type, body.payment_identifier, {
            payment_receive_date: body.payment_receive_date,
            status: body.status,
        });
    }
};
exports.OrderController = OrderController;
__decorate([
    (0, common_1.Get)('/all-orders'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "loadAllOrdersWithAttributes", null);
__decorate([
    (0, common_1.Get)('/all-amc'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('filter')),
    __param(3, (0, common_1.Query)('upcoming')),
    __param(4, (0, common_1.Query)('startDate')),
    __param(5, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "loadAllAMC", null);
__decorate([
    (0, common_1.Get)('/pending-payments'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getAllPendingPayments", null);
__decorate([
    (0, common_1.Get)('/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getOrderById", null);
__decorate([
    (0, common_1.Get)('/:id/amc'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getAMCByOrderId", null);
__decorate([
    (0, common_1.Get)('/client/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getOrdersByClientId", null);
__decorate([
    (0, common_1.Get)('/license/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getLicenseById", null);
__decorate([
    (0, common_1.Get)('/additional-service/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getAdditionalServiceById", null);
__decorate([
    (0, common_1.Get)('/customization/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getCustomizationById", null);
__decorate([
    (0, common_1.Get)('/amc-payments-review/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getAmcReviewByOrderId", null);
__decorate([
    (0, common_1.Post)('/:clientId'),
    __param(0, (0, common_1.Param)('clientId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_order_dto_1.CreateOrderDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Patch)('/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "updateOrder", null);
__decorate([
    (0, common_1.Post)('/:orderId/license'),
    __param(0, (0, common_1.Param)('orderId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_license_dto_1.CreateLicenseDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "addLicense", null);
__decorate([
    (0, common_1.Post)('/:orderId/additional-service'),
    __param(0, (0, common_1.Param)('orderId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_additional_service_dto_1.CreateAdditionalServiceDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "addAdditionalService", null);
__decorate([
    (0, common_1.Post)('/:orderId/customization'),
    __param(0, (0, common_1.Param)('orderId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_customization_service_dto_1.CreateCustomizationDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "addCustomization", null);
__decorate([
    (0, common_1.Patch)('/customization/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_customization_service_dto_1.CreateCustomizationDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "updateCustomizationById", null);
__decorate([
    (0, common_1.Patch)('/license/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_license_dto_1.CreateLicenseDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "updateLicenseById", null);
__decorate([
    (0, common_1.Patch)('/additional-service/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_additional_service_dto_1.CreateAdditionalServiceDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "updateAdditionalServiceById", null);
__decorate([
    (0, common_1.Patch)('/amc/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_amc_dto_1.UpdateAMCDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "updateAMCById", null);
__decorate([
    (0, common_1.Patch)('/amc/:id/payments'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "addPaymentsIntoAMC", null);
__decorate([
    (0, common_1.Patch)('/amc/:id/payment/:paymentId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('paymentId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_amc_dto_1.UpdateAMCPaymentDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "updateAMCPaymentById", null);
__decorate([
    (0, common_1.Patch)('/pending-payments/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_pending_payment_1.UpdatePendingPaymentDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "updatePendingPaymentStatus", null);
exports.OrderController = OrderController = __decorate([
    (0, common_1.Controller)('orders'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [order_service_1.OrderService])
], OrderController);
//# sourceMappingURL=order.controller.js.map