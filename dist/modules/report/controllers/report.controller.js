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
exports.ReportController = void 0;
const auth_guard_1 = require("../../../common/guards/auth.guard");
const common_1 = require("@nestjs/common");
const report_service_1 = require("../services/report.service");
let ReportController = class ReportController {
    constructor(reportService) {
        this.reportService = reportService;
    }
    async getOverallSalesReport(filter, year, quarter, startDate, endDate) {
        return await this.reportService.getDetailedOverallSalesReport(filter, {
            startDate: startDate === 'undefined' ? undefined : new Date(startDate),
            endDate: endDate === 'undefined' ? undefined : new Date(endDate),
            year: year === 'undefined' ? undefined : Number(year),
            quarter: year === 'undefined' ? undefined : quarter,
        });
    }
    async getAMCRevenueReport(filter, year, quarter, startDate, endDate) {
        return await this.reportService.getAMCRevenueReport(filter, {
            startDate: startDate === 'undefined' ? undefined : new Date(startDate),
            endDate: endDate === 'undefined' ? undefined : new Date(endDate),
            year: year === 'undefined' ? undefined : Number(year),
            quarter: year === 'undefined' ? undefined : quarter,
        });
    }
    async getProductWiseRevenueDistribution(filter, year, quarter, startDate, endDate) {
        return await this.reportService.getProductWiseRevenueDistribution(filter, {
            startDate: startDate === 'undefined' ? undefined : new Date(startDate),
            endDate: endDate === 'undefined' ? undefined : new Date(endDate),
            year: year === 'undefined' ? undefined : Number(year),
            quarter: year === 'undefined' ? undefined : quarter,
        });
    }
    async getAMCAnnualBreakdown(filter, year, quarter, startDate, endDate, productId) {
        return await this.reportService.getAMCAnnualBreakdown(filter, {
            startDate: startDate === 'undefined' || !startDate
                ? undefined
                : new Date(startDate),
            endDate: endDate === 'undefined' || !endDate ? undefined : new Date(endDate),
            year: year === 'undefined' || !year ? undefined : Number(year),
            quarter: year === 'undefined' || !year ? undefined : quarter,
            productId: productId === 'undefined' || !productId ? undefined : productId,
        });
    }
    async getIndustryWiseRevenueDistribution(filter, year, quarter, month) {
        return await this.reportService.getIndustryWiseRevenueDistribution(filter, {
            year: year === 'undefined' ? undefined : Number(year),
            quarter: year === 'undefined' ? undefined : quarter,
            month: month === 'undefined' ? undefined : Number(month),
        });
    }
};
exports.ReportController = ReportController;
__decorate([
    (0, common_1.Get)('overall-sales-report'),
    __param(0, (0, common_1.Query)('filter')),
    __param(1, (0, common_1.Query)('year')),
    __param(2, (0, common_1.Query)('quarter')),
    __param(3, (0, common_1.Query)('startDate')),
    __param(4, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "getOverallSalesReport", null);
__decorate([
    (0, common_1.Get)('amc-revenue-report'),
    __param(0, (0, common_1.Query)('filter')),
    __param(1, (0, common_1.Query)('year')),
    __param(2, (0, common_1.Query)('quarter')),
    __param(3, (0, common_1.Query)('startDate')),
    __param(4, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "getAMCRevenueReport", null);
__decorate([
    (0, common_1.Get)('product-wise-revenue-distribution'),
    __param(0, (0, common_1.Query)('filter')),
    __param(1, (0, common_1.Query)('year')),
    __param(2, (0, common_1.Query)('quarter')),
    __param(3, (0, common_1.Query)('startDate')),
    __param(4, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "getProductWiseRevenueDistribution", null);
__decorate([
    (0, common_1.Get)('amc-annual-breakdown'),
    __param(0, (0, common_1.Query)('filter')),
    __param(1, (0, common_1.Query)('year')),
    __param(2, (0, common_1.Query)('quarter')),
    __param(3, (0, common_1.Query)('startDate')),
    __param(4, (0, common_1.Query)('endDate')),
    __param(5, (0, common_1.Query)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "getAMCAnnualBreakdown", null);
__decorate([
    (0, common_1.Get)('industry-wise-revenue-distribution'),
    __param(0, (0, common_1.Query)('filter')),
    __param(1, (0, common_1.Query)('year')),
    __param(2, (0, common_1.Query)('quarter')),
    __param(3, (0, common_1.Query)('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "getIndustryWiseRevenueDistribution", null);
exports.ReportController = ReportController = __decorate([
    (0, common_1.Controller)('reports'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [report_service_1.ReportService])
], ReportController);
//# sourceMappingURL=report.controller.js.map