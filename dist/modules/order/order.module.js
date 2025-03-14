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
exports.OrderModule = void 0;
const common_1 = require("@nestjs/common");
const order_controller_1 = require("./controller/order.controller");
const order_service_1 = require("./services/order.service");
const mongoose_1 = require("@nestjs/mongoose");
const storage_module_1 = require("../../common/storage/storage.module");
const customization_schema_1 = require("../../db/schema/order/customization.schema");
const additional_service_schema_1 = require("../../db/schema/order/additional-service.schema");
const product_order_schema_1 = require("../../db/schema/order/product-order.schema");
const license_schema_1 = require("../../db/schema/order/license.schema");
const product_schema_1 = require("../../db/schema/product.schema");
const client_schema_1 = require("../../db/schema/client.schema");
const amc_schema_1 = require("../../db/schema/amc/amc.schema");
const mail_service_1 = require("../../common/mail/service/mail.service");
const cache_manager_1 = require("@nestjs/cache-manager");
let OrderModule = class OrderModule {
    constructor(orderService) {
        this.orderService = orderService;
    }
    async onModuleInit() {
    }
};
exports.OrderModule = OrderModule;
exports.OrderModule = OrderModule = __decorate([
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
            storage_module_1.StorageModule,
            cache_manager_1.CacheModule.register({
                ttl: 900,
                max: 100,
                isGlobal: false,
            })
        ],
        controllers: [order_controller_1.OrderController],
        providers: [order_service_1.OrderService, mail_service_1.MailService],
        exports: [order_service_1.OrderService],
    }),
    __metadata("design:paramtypes", [order_service_1.OrderService])
], OrderModule);
//# sourceMappingURL=order.module.js.map