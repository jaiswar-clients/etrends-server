"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientModule = void 0;
const common_1 = require("@nestjs/common");
const client_controller_1 = require("./controller/client.controller");
const client_service_1 = require("./services/client.service");
const mongoose_1 = require("@nestjs/mongoose");
const client_schema_1 = require("../../db/schema/client.schema");
const product_order_schema_1 = require("../../db/schema/order/product-order.schema");
let ClientModule = class ClientModule {
};
exports.ClientModule = ClientModule;
exports.ClientModule = ClientModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: client_schema_1.Client.name, schema: client_schema_1.ClientSchema },
                { name: product_order_schema_1.Order.name, schema: product_order_schema_1.OrderSchema },
            ]),
        ],
        controllers: [client_controller_1.ClientController],
        providers: [client_service_1.ClientService],
    })
], ClientModule);
//# sourceMappingURL=client.module.js.map