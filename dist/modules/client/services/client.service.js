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
exports.ClientService = void 0;
const client_schema_1 = require("../../../db/schema/client.schema");
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const logger_service_1 = require("../../../common/logger/services/logger.service");
const cryptography_1 = require("../../../utils/cryptography");
const product_order_schema_1 = require("../../../db/schema/order/product-order.schema");
const amc_schema_1 = require("../../../db/schema/amc/amc.schema");
let ClientService = class ClientService {
    constructor(clientModel, orderModel, loggerService) {
        this.clientModel = clientModel;
        this.orderModel = orderModel;
        this.loggerService = loggerService;
    }
    async getAllClients(page = 1, limit = 10, fetchAll = false) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getAllClients: Fetching Clients info ',
                page,
                limit,
            }));
            let clients;
            if (fetchAll) {
                clients = await this.clientModel
                    .find({ is_parent_company: false })
                    .sort({ createdAt: -1 })
                    .select('orders name industry createdAt')
                    .populate({
                    path: 'orders',
                    model: 'Order',
                    select: 'products',
                    populate: {
                        path: 'products',
                        model: 'Product',
                        select: 'name short_name',
                    },
                });
            }
            else {
                clients = await this.clientModel
                    .find({ is_parent_company: false })
                    .sort({ createdAt: -1 })
                    .select('orders name industry createdAt')
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .populate({
                    path: 'orders',
                    model: 'Order',
                    select: 'products',
                    populate: {
                        path: 'products',
                        model: 'Product',
                        select: 'name',
                    },
                });
            }
            clients = clients.map((client) => {
                let products = [];
                client.orders.map((order) => {
                    products = order.products.map((product) => product.name);
                });
                return {
                    ...client.toObject(),
                    products,
                };
            });
            this.loggerService.warn(JSON.stringify({
                message: 'getAllClients: Clients Fetched',
                clients,
            }));
            return clients;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getAllClients: Failed to get clients',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message ?? 'Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
    async getAllParentCompanies() {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getAllParentCompanies: Fetching Parent Companies',
            }));
            const parentCompanies = await this.clientModel
                .find({
                is_parent_company: true,
            })
                .select('name');
            this.loggerService.warn(JSON.stringify({
                message: 'getAllParentCompanies: Parent Companies Fetched',
                parentCompanies,
            }));
            return parentCompanies;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getAllParentCompanies: Failed to get parent companies',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message ?? 'Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
    async getClientById(id) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getClientById: Fetching Client info ',
                clienId: id,
            }));
            const client = await this.clientModel.findById(id).populate({
                path: 'parent_company_id',
                select: 'name _id',
                model: 'Client',
            });
            if (!client) {
                this.loggerService.warn(JSON.stringify({
                    message: 'getClientById: No Client found by this ID',
                    client,
                }));
                throw new common_1.HttpException('No Client found by this ID', common_1.HttpStatus.NOT_FOUND);
            }
            const clientObj = client.toObject();
            if (clientObj.parent_company_id?._id) {
                const parent_company = clientObj.parent_company_id;
                const parentCompany = {
                    id: parent_company._id,
                    name: parent_company.name,
                };
                clientObj['parent_company'] = parentCompany;
                delete clientObj.parent_company_id;
            }
            this.loggerService.warn(JSON.stringify({
                message: 'getClientById: Client Fetched',
                clientObj,
            }));
            return clientObj;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getClientById: Failed to create client',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message ?? 'Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
    async createClient(body) {
        const { name, client_id, parent_company } = body;
        this.loggerService.log(JSON.stringify({
            message: 'createClient: Initiating client creation process',
            clientName: name,
        }));
        try {
            this.loggerService.log(JSON.stringify({
                message: 'createClient: Checking if client already exists',
                client_id,
            }));
            const isClientAlreadyExist = await this.clientModel.findOne({
                client_id,
            });
            if (isClientAlreadyExist) {
                this.loggerService.warn(JSON.stringify({
                    message: 'createClient: Client already exists with this ID',
                    client_id,
                }));
                throw new common_1.HttpException('Client already exists with this ID', common_1.HttpStatus.BAD_REQUEST);
            }
            this.loggerService.log(JSON.stringify({
                message: 'createClient: Creating new client in the database',
                clientName: name,
            }));
            if (body.pan_number) {
                body.pan_number = (0, cryptography_1.encrypt)(body.pan_number);
            }
            if (body.gst_number) {
                body.gst_number = (0, cryptography_1.encrypt)(body.gst_number);
            }
            if (body.vendor_id) {
                body.vendor_id = (0, cryptography_1.encrypt)(body.vendor_id);
            }
            if (parent_company.new && parent_company.name) {
                const parentCompany = new this.clientModel({
                    name: parent_company.name,
                    is_parent_company: true,
                });
                await parentCompany.save();
                body['parent_company_id'] = parentCompany._id;
                delete body.parent_company;
            }
            else {
                body['parent_company_id'] = parent_company.id;
                delete body.parent_company;
            }
            const client = new this.clientModel({
                ...body,
            });
            const savedClient = await client.save();
            this.loggerService.log(JSON.stringify({
                message: 'createClient: Client successfully created',
                clientId: savedClient._id,
                clientName: name,
            }));
            return savedClient;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'createClient: Failed to create client',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message ?? 'Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
    async updateClient(dbClientId, body) {
        const { name, pan_number, parent_company, gst_number, vendor_id } = body;
        this.loggerService.log(JSON.stringify({
            message: 'updateClient: Initiating client update process',
            dbClientId,
            clientName: name,
        }));
        try {
            const client = await this.clientModel.findById(dbClientId);
            if (!client) {
                this.loggerService.warn(JSON.stringify({
                    message: 'updateClient: Client not found with this ID',
                    dbClientId,
                }));
                throw new common_1.HttpException('Client not found with this ID', common_1.HttpStatus.NOT_FOUND);
            }
            this.loggerService.log(JSON.stringify({
                message: 'updateClient: Client found, proceeding to update',
                dbClientId,
            }));
            if (pan_number) {
                body.pan_number = (0, cryptography_1.encrypt)(pan_number);
            }
            if (gst_number) {
                body.gst_number = (0, cryptography_1.encrypt)(gst_number);
            }
            if (vendor_id) {
                body.vendor_id = (0, cryptography_1.encrypt)(vendor_id);
            }
            if (parent_company.new && parent_company.name) {
                const parentCompany = new this.clientModel({
                    name: parent_company.name,
                    is_parent_company: true,
                });
                await parentCompany.save();
                body['parent_company_id'] = parentCompany._id;
                delete body.parent_company;
            }
            else {
                body['parent_company_id'] = parent_company.id;
                delete body.parent_company;
            }
            const updatedClient = await this.clientModel.findByIdAndUpdate(dbClientId, { $set: body }, { new: true });
            this.loggerService.log(JSON.stringify({
                message: 'updateClient: Client successfully updated',
                clientId: updatedClient._id,
                clientName: updatedClient.name,
            }));
            return updatedClient;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'updateClient: Failed to update client',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message ?? 'Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
    async getProductsPurchasedByClient(clientId) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getProductsPurchasedByClient: Fetching Products purchased by client',
                clientId,
            }));
            const client = await this.clientModel.findById(clientId);
            if (!client) {
                this.loggerService.warn(JSON.stringify({
                    message: 'getProductsPurchasedByClient: No client found by this ID',
                    clientId,
                }));
                throw new common_1.HttpException('No client found by this ID', common_1.HttpStatus.NOT_FOUND);
            }
            const orders = await this.orderModel
                .find({
                _id: { $in: client.orders },
            })
                .populate([
                {
                    path: 'products',
                    model: 'Product',
                },
                {
                    path: 'amc_id',
                    model: 'AMC',
                },
            ]);
            const products = orders.reduce((acc, order) => {
                const productsWithOrderId = order.products.map((product) => ({
                    ...product._doc,
                    order_id: order._id,
                    amc_rate: order.amc_rate,
                    total_cost: order.amc_id.total_cost,
                }));
                const uniqueProducts = [...acc];
                productsWithOrderId.forEach((product) => {
                    const existingIndex = uniqueProducts.findIndex((p) => p._id.toString() === product._id.toString());
                    if (existingIndex === -1) {
                        uniqueProducts.push(product);
                    }
                });
                return uniqueProducts;
            }, []);
            this.loggerService.warn(JSON.stringify({
                message: 'getProductsPurchasedByClient: Products Fetched',
                products,
            }));
            return products;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getProductsPurchasedByClient: Failed to get products',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message ?? 'Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
    async getProfitFromClient(clientId) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getProfitFromClient: Getting profits from client',
                clientId,
            }));
            const client = await this.clientModel.findById(clientId);
            if (!client) {
                throw new common_1.HttpException('Client not found', common_1.HttpStatus.NOT_FOUND);
            }
            const orders = await this.orderModel
                .find({
                _id: { $in: client.orders },
            })
                .populate([
                {
                    path: 'customizations',
                    model: 'Customization',
                },
                {
                    path: 'licenses',
                    model: 'License',
                },
                {
                    path: 'additional_services',
                    model: 'AdditionalService',
                },
                {
                    path: 'amc_id',
                    model: 'AMC',
                },
                {
                    path: 'products',
                    model: 'Product',
                    select: 'name short_name',
                },
            ]);
            let totalProfit = 0;
            let upcomingAmcProfit = 0;
            let totalAMCCollected = 0;
            let revenueBreakdown = {
                base_cost: 0,
                customizations: 0,
                licenses: 0,
                additional_services: 0,
                amc: 0,
            };
            for (const order of orders) {
                totalProfit += order.base_cost || 0;
                revenueBreakdown.base_cost += order.base_cost || 0;
                const amc = order.amc_id;
                if (order.customizations?.length) {
                    const customizationsCost = order.customizations.reduce((sum, customization) => sum + (customization.cost || 0), 0);
                    totalProfit += customizationsCost;
                    revenueBreakdown.customizations += customizationsCost;
                }
                if (order.licenses?.length) {
                    const licensesCost = order.licenses.reduce((sum, license) => sum + (license.total_license || 0) * (license.rate?.amount || 0), 0);
                    totalProfit += licensesCost;
                    revenueBreakdown.licenses += licensesCost;
                }
                if (order.additional_services?.length) {
                    const additionalServicesCost = order.additional_services.reduce((sum, service) => sum + (service.cost || 0), 0);
                    totalProfit += additionalServicesCost;
                    revenueBreakdown.additional_services += additionalServicesCost;
                }
                if (amc.payments.length > 1) {
                    const amcPayments = amc.payments.slice(1);
                    const totalPaidAmcs = amcPayments.filter((payment) => payment.status === amc_schema_1.PAYMENT_STATUS_ENUM.PAID).length;
                    const amcCollection = totalPaidAmcs * amc.amount;
                    totalAMCCollected += amcCollection;
                    revenueBreakdown.amc += amcCollection;
                }
            }
            const formattedOrders = orders.map((order) => ({
                id: order._id,
                products: order.products,
                base_cost: order.base_cost,
                customizations: order.customizations,
                licenses: order.licenses,
                additional_services: order.additional_services,
                amc_details: order.amc_id,
                agreements: order.agreements,
                status: order.status,
                purchased_date: order.purchased_date,
            }));
            return {
                total_profit: totalProfit,
                upcoming_amc_profit: upcomingAmcProfit,
                total_amc_collection: totalAMCCollected,
                revenue_breakdown: revenueBreakdown,
                currency: 'INR',
                orders: formattedOrders,
            };
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getProfitFromClient: Failed to calculate profits',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException(error.message ?? 'Failed to calculate profits', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
};
exports.ClientService = ClientService;
exports.ClientService = ClientService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(client_schema_1.Client.name)),
    __param(1, (0, mongoose_1.InjectModel)(product_order_schema_1.Order.name)),
    __metadata("design:paramtypes", [Object, Object, logger_service_1.LoggerService])
], ClientService);
//# sourceMappingURL=client.service.js.map