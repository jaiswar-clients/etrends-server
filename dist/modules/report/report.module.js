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
exports.ReportModule = void 0;
const common_1 = require("@nestjs/common");
const report_controller_1 = require("./controllers/report.controller");
const report_service_1 = require("./services/report.service");
const mongoose_1 = require("@nestjs/mongoose");
const product_order_schema_1 = require("../../db/schema/order/product-order.schema");
const license_schema_1 = require("../../db/schema/order/license.schema");
const product_schema_1 = require("../../db/schema/product.schema");
const client_schema_1 = require("../../db/schema/client.schema");
const amc_schema_1 = require("../../db/schema/amc/amc.schema");
const customization_schema_1 = require("../../db/schema/order/customization.schema");
const additional_service_schema_1 = require("../../db/schema/order/additional-service.schema");
let ReportModule = class ReportModule {
    constructor(reportService) {
        this.reportService = reportService;
    }
    async onModuleInit() {
    }
};
exports.ReportModule = ReportModule;
exports.ReportModule = ReportModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: product_order_schema_1.Order.name, schema: product_order_schema_1.OrderSchema },
                { name: license_schema_1.License.name, schema: license_schema_1.LicenseSchema },
                { name: customization_schema_1.Customization.name, schema: customization_schema_1.CustomizationSchema },
                { name: product_schema_1.Product.name, schema: product_schema_1.ProductSchema },
                { name: client_schema_1.Client.name, schema: client_schema_1.ClientSchema },
                { name: additional_service_schema_1.AdditionalService.name, schema: additional_service_schema_1.AdditionalServiceSchema },
                { name: amc_schema_1.AMC.name, schema: amc_schema_1.AMCSchema },
            ]),
        ],
        controllers: [report_controller_1.ReportController],
        providers: [report_service_1.ReportService],
    }),
    __metadata("design:paramtypes", [report_service_1.ReportService])
], ReportModule);
//# sourceMappingURL=report.module.js.map