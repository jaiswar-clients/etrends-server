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
exports.OrderService = void 0;
const customization_schema_1 = require("../../../db/schema/order/customization.schema");
const license_schema_1 = require("../../../db/schema/order/license.schema");
const product_order_schema_1 = require("../../../db/schema/order/product-order.schema");
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const product_schema_1 = require("../../../db/schema/product.schema");
const logger_service_1 = require("../../../common/logger/services/logger.service");
const client_schema_1 = require("../../../db/schema/client.schema");
const storage_service_1 = require("../../../common/storage/services/storage.service");
const additional_service_schema_1 = require("../../../db/schema/order/additional-service.schema");
const order_enum_1 = require("../../../common/types/enums/order.enum");
const amc_schema_1 = require("../../../db/schema/amc/amc.schema");
const mongoose_2 = require("mongoose");
const misc_1 = require("../../../utils/misc");
let OrderService = class OrderService {
    constructor(orderModel, licenseModel, customizationModel, productModel, clientModel, additionalServiceModel, amcModel, loggerService, storageService) {
        this.orderModel = orderModel;
        this.licenseModel = licenseModel;
        this.customizationModel = customizationModel;
        this.productModel = productModel;
        this.clientModel = clientModel;
        this.additionalServiceModel = additionalServiceModel;
        this.amcModel = amcModel;
        this.loggerService = loggerService;
        this.storageService = storageService;
    }
    async createOrder(clientId, body) {
        if (!clientId) {
            this.loggerService.error(JSON.stringify({
                message: 'createOrder: Client id is required',
            }));
            throw new common_1.HttpException('Client id is required', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            this.loggerService.log(JSON.stringify({
                message: 'createOrder: Creating new order',
            }));
            const { license_details, customization, products } = body;
            const productsList = await this.productModel.find({
                _id: { $in: products },
            });
            this.loggerService.log(JSON.stringify({
                message: 'createOrder: Found products',
                productsList,
            }));
            if (productsList.length !== products.length) {
                throw new Error('Invalid product id');
            }
            let license_id = null;
            const doesHaveLicense = productsList.some((product) => product.does_have_license);
            if (doesHaveLicense &&
                !license_details.cost_per_license &&
                !license_details.total_license) {
                throw new Error('License is required');
            }
            else if (doesHaveLicense &&
                license_details.cost_per_license &&
                license_details.total_license) {
                const licenseProduct = productsList.find((product) => product.does_have_license);
                if (!licenseProduct) {
                    throw new Error('License product not found');
                }
                const license = new this.licenseModel({
                    rate: {
                        amount: license_details.cost_per_license,
                        percentage: 0,
                    },
                    total_license: license_details.total_license,
                    product_id: licenseProduct._id,
                });
                await license.save();
                license_id = license._id;
                this.loggerService.log(JSON.stringify({
                    message: 'createOrder: Created license',
                    license_id,
                }));
            }
            let customization_id = null;
            if (customization.cost) {
                const customizationData = new this.customizationModel({
                    cost: customization.cost,
                    modules: customization.modules,
                    product_id: products[0],
                });
                await customizationData.save();
                customization_id = customizationData._id;
                this.loggerService.log(JSON.stringify({
                    message: 'createOrder: Created customization',
                    customization_id,
                }));
            }
            const orderPayload = {
                ...body,
                client_id: clientId,
                purchase_date: new Date(body.purchased_date),
            };
            delete orderPayload.license_details;
            delete orderPayload.customization;
            if (license_id) {
                orderPayload['licenses'] = [license_id];
                orderPayload['is_purchased_with_order.license'] = true;
            }
            if (customization_id) {
                orderPayload['customizations'] = [customization_id];
                orderPayload['is_purchased_with_order.customization'] = true;
            }
            this.loggerService.log(JSON.stringify({
                message: 'createOrder: Creating order',
                orderPayload,
            }));
            const order = new this.orderModel(orderPayload);
            let amcPercentage = order.amc_rate.percentage;
            const licenseTotalCost = license_details.cost_per_license * license_details.total_license || 0;
            const amcTotalCost = (customization.cost + licenseTotalCost || 0) + order.base_cost;
            const amcAmount = (amcTotalCost / 100) * amcPercentage;
            this.loggerService.log(JSON.stringify({
                message: 'createOrder: Creating AMC',
                amcTotalCost,
                amcAmount,
                amcPercentage,
            }));
            const till_date_of_payment = this.getNextDate(body.amc_start_date, 12);
            const payments = body.amc_start_date
                ? [
                    {
                        from_date: body.amc_start_date,
                        to_date: till_date_of_payment,
                        status: amc_schema_1.PAYMENT_STATUS_ENUM.PAID,
                    },
                ]
                : [];
            const amc = new this.amcModel({
                order_id: order._id,
                client_id: clientId,
                total_cost: amcTotalCost,
                amount: amcAmount,
                products: products,
                amc_percentage: amcPercentage,
                start_date: new Date(body.amc_start_date),
                payments,
            });
            await amc.save();
            this.loggerService.log(JSON.stringify({
                message: 'createOrder: AMC created',
                amc_id: amc._id,
            }));
            order.amc_id = new mongoose_2.Types.ObjectId(amc._id.toString());
            await order.save();
            this.loggerService.log(JSON.stringify({
                message: 'createOrder: Order created successfully',
                order_id: order._id,
            }));
            if (license_id) {
                await this.licenseModel.findByIdAndUpdate(license_id, {
                    order_id: order._id,
                });
            }
            if (customization_id) {
                await this.customizationModel.findByIdAndUpdate(customization_id, {
                    order_id: order._id,
                });
            }
            const updatedClient = await this.clientModel.findOneAndUpdate({ _id: clientId }, {
                $push: { orders: order._id, amcs: amc._id },
            }, { new: true });
            if (!updatedClient) {
                throw new Error('Client not found');
            }
            this.loggerService.log(JSON.stringify({
                message: 'createOrder: Updated client orders',
                client_id: clientId,
                order_id: order._id,
                updated_client: updatedClient,
            }));
            return order;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'createOrder: Error creating order',
                error: error.message,
            }));
            throw new common_1.HttpException('Server error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateOrder(orderId, body) {
        if (!orderId) {
            this.loggerService.error(JSON.stringify({
                message: 'updateFirstOrder: Order id is required',
            }));
            throw new common_1.HttpException('Order id is required', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            const existingOrder = await this.orderModel.findById(orderId).populate({
                path: 'amc_id',
                model: amc_schema_1.AMC.name,
            });
            if (!existingOrder) {
                throw new common_1.HttpException('Order not found', common_1.HttpStatus.NOT_FOUND);
            }
            const { license_details, customization, products } = body;
            const productsList = await this.productModel.find({
                _id: { $in: products },
            });
            if (productsList.length !== products.length) {
                throw new Error('Invalid product id');
            }
            let license_id = existingOrder.licenses?.[0]?.toString() || null;
            const doesHaveLicense = productsList.some((product) => product.does_have_license);
            if (doesHaveLicense &&
                license_details?.cost_per_license &&
                license_details?.total_license) {
                const licenseProduct = productsList.find((product) => product.does_have_license);
                if (!licenseProduct) {
                    throw new Error('License product not found');
                }
                const licenseUpdate = {
                    rate: {
                        amount: license_details.cost_per_license,
                        percentage: 0,
                    },
                    total_license: license_details.total_license,
                    product_id: licenseProduct._id,
                };
                if (license_id) {
                    await this.licenseModel.findByIdAndUpdate(license_id, licenseUpdate);
                }
                else {
                    const license = await this.licenseModel.create(licenseUpdate);
                    license_id = license._id.toString();
                }
            }
            let customization_id = existingOrder.customizations?.[0]?.toString() || null;
            if (customization?.modules?.length) {
                const customizationUpdate = {
                    cost: customization.cost,
                    modules: customization.modules,
                    product_id: products[0],
                };
                if (customization_id) {
                    await this.customizationModel.findByIdAndUpdate(customization_id, customizationUpdate);
                }
                else {
                    const customizationData = await this.customizationModel.create(customizationUpdate);
                    customization_id = customizationData._id.toString();
                }
            }
            const orderPayload = {
                ...body,
                license_id,
                customization_id,
            };
            delete orderPayload.license_details;
            delete orderPayload.customization;
            orderPayload.purchase_order_document = (0, misc_1.extractS3Key)(orderPayload.purchase_order_document);
            orderPayload.invoice_document = (0, misc_1.extractS3Key)(orderPayload.invoice_document);
            orderPayload.other_document.url = (0, misc_1.extractS3Key)(orderPayload.other_document.url);
            orderPayload.agreements.map((agreement) => {
                agreement.document = (0, misc_1.extractS3Key)(agreement.document);
                return agreement;
            });
            const updatedOrder = await this.orderModel.findByIdAndUpdate(orderId, orderPayload, { new: true });
            const licenseTotalCost = license_details?.cost_per_license * license_details?.total_license || 0;
            const amcTotalCost = ((customization?.cost || 0) + licenseTotalCost || 0) +
                (updatedOrder.base_cost || 0);
            let amcPercentage = updatedOrder.amc_rate?.percentage || 0;
            const amcAmount = (amcTotalCost / 100) * amcPercentage;
            if (updatedOrder.amc_id) {
                const DEFAULT_AMC_CYCLE_IN_MONTHS = 12;
                const till_date_of_payment = this.getNextDate(body.amc_start_date, DEFAULT_AMC_CYCLE_IN_MONTHS);
                const amc = await this.amcModel.findById(updatedOrder.amc_id);
                const payments = !amc?.payments?.length && body.amc_start_date
                    ? [
                        {
                            from_date: body.amc_start_date,
                            to_date: till_date_of_payment,
                            status: amc_schema_1.PAYMENT_STATUS_ENUM.PAID,
                        },
                    ]
                    : amc?.payments || [];
                await this.amcModel.findByIdAndUpdate(updatedOrder.amc_id, {
                    total_cost: amcTotalCost,
                    amount: amcAmount,
                    products: products,
                    amc_percentage: amcPercentage,
                    start_date: body.amc_start_date
                        ? new Date(body.amc_start_date)
                        : undefined,
                    payments,
                });
            }
            this.loggerService.log(JSON.stringify({
                message: 'updateFirstOrder: Order updated successfully',
                order_id: updatedOrder._id,
            }));
            return updatedOrder;
        }
        catch (error) {
            console.log({ error });
            this.loggerService.error(JSON.stringify({
                message: 'updateFirstOrder: Error updating order',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getOrderById(orderId) {
        if (!orderId) {
            this.loggerService.error(JSON.stringify({
                message: 'getOrderById: Order id is required',
            }));
            throw new common_1.HttpException('Order id is required', common_1.HttpStatus.BAD_REQUEST);
        }
        const orders = await this.orderModel.find();
        for (const order of orders) {
            if (order.agreements && !Array.isArray(order.agreements)) {
                order.agreements = [order.agreements];
                await order.save();
            }
        }
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getOrderById: Fetching order',
                orderId,
            }));
            const order = await this.orderModel.findById(orderId).populate([
                { path: 'licenses', model: license_schema_1.License.name },
                { path: 'customizations', model: customization_schema_1.Customization.name },
            ]);
            if (!order) {
                this.loggerService.error(JSON.stringify({
                    message: 'getOrderById: Order not found',
                    orderId,
                }));
                throw new common_1.HttpException('Order not found', common_1.HttpStatus.NOT_FOUND);
            }
            const orderObj = order.toObject();
            if (orderObj.licenses && orderObj.licenses.length > 0) {
                orderObj['license'] = orderObj.licenses[0];
                delete orderObj.licenses;
            }
            if (orderObj.customizations && orderObj.customizations.length > 0) {
                orderObj['customization'] = orderObj.customizations[0];
                delete orderObj.customizations;
            }
            this.loggerService.log(JSON.stringify({
                message: 'getOrderById: Order found successfully',
                orderId: order._id,
            }));
            if (orderObj.purchase_order_document) {
                orderObj.purchase_order_document = this.storageService.get(orderObj.purchase_order_document);
            }
            if (orderObj.invoice_document) {
                orderObj.invoice_document = this.storageService.get(orderObj.invoice_document);
            }
            if (orderObj.other_document) {
                orderObj.other_document.url = this.storageService.get(orderObj.other_document.url);
            }
            if (orderObj.agreements.length) {
                for (let i = 0; i < orderObj.agreements.length; i++) {
                    orderObj.agreements[i].document = this.storageService.get(orderObj.agreements[i].document);
                }
            }
            return orderObj;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getOrderById: Error fetching order',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getOrdersByClientId(clientId) {
        if (!clientId) {
            this.loggerService.error(JSON.stringify({
                message: 'getOrdersByClientId: Client id is required',
            }));
            throw new common_1.HttpException('Client id is required', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getOrdersByClientId: Fetching client orders',
                clientId,
            }));
            const client = await this.clientModel.findById(clientId);
            if (!client) {
                this.loggerService.error(JSON.stringify({
                    message: 'getOrdersByClientId: Client not found',
                    clientId,
                }));
                throw new common_1.HttpException('Client not found', common_1.HttpStatus.NOT_FOUND);
            }
            const orders = await this.orderModel
                .find({ _id: { $in: client.orders } })
                .populate([
                { path: 'license_id', model: license_schema_1.License.name },
                { path: 'customization_id', model: customization_schema_1.Customization.name },
                { path: 'products', model: product_schema_1.Product.name },
            ]);
            const ordersList = orders.map((order) => {
                const orderObj = order.toObject();
                if (orderObj.licenses && orderObj.licenses.length > 0) {
                    orderObj['license'] = orderObj.licenses[0];
                    delete orderObj.licenses;
                }
                if (orderObj.customizations && orderObj.customizations.length > 0) {
                    orderObj['customization'] = orderObj.customizations[0];
                    delete orderObj.customizations;
                }
                if (orderObj.purchase_order_document) {
                    orderObj.purchase_order_document = this.storageService.get(orderObj.purchase_order_document);
                }
                if (orderObj.agreements.length) {
                    for (let i = 0; i < orderObj.agreements.length; i++) {
                        orderObj.agreements[i].document = this.storageService.get(orderObj.agreements[i].document);
                    }
                }
                return orderObj;
            });
            this.loggerService.log(JSON.stringify({
                message: 'getOrdersByClientId: Orders fetched successfully',
                clientId,
                orders: ordersList,
            }));
            return ordersList;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getOrdersByClientId: Error fetching client orders',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async addLicense(orderId, body) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'createLicense: Creating new license',
                body,
            }));
            const { cost_per_license, total_license, product_id } = body;
            const license = new this.licenseModel({
                rate: {
                    amount: cost_per_license,
                    percentage: 0,
                },
                total_license,
                product_id,
                order_id: orderId,
                purchase_date: body.purchase_date,
                purchase_order_document: body.purchase_order_document,
                invoice: body.invoice,
            });
            await license.save();
            this.loggerService.log(JSON.stringify({
                message: 'createLicense: License created successfully',
                license_id: license._id,
            }));
            const cost = cost_per_license * total_license;
            const amc = await this.amcModel.findOne({
                order_id: new mongoose_2.Types.ObjectId(orderId),
            });
            if (!amc) {
                throw new Error('AMC not found for this order');
            }
            const newTotalCost = amc.total_cost + cost;
            const newAmount = (newTotalCost / 100) * amc.amc_percentage;
            this.loggerService.log(JSON.stringify({
                message: 'addCustomization: AMC Calc completed',
                newTotalCost,
                newAmount,
                used: { percentage: amc.amc_percentage, total_cost: amc.total_cost },
            }));
            const amcUpdateResult = await this.amcModel.findByIdAndUpdate(amc._id, {
                total_cost: newTotalCost,
                amount: newAmount,
            }, { new: true });
            this.loggerService.log(JSON.stringify({
                message: 'addCustomization: AMC update completed',
                amcUpdateResult,
                orderId,
            }));
            await this.orderModel.findByIdAndUpdate(orderId, {
                $push: { licenses: license._id },
            });
            return license;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'createLicense: Error creating license',
                error: error.message,
            }));
            throw new common_1.HttpException('Server error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async addAdditionalService(orderId, body) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'addAdditionalService: Creating new additional service',
                body,
            }));
            const additionalService = new this.additionalServiceModel({
                ...body,
                order_id: orderId,
            });
            await additionalService.save();
            this.loggerService.log(JSON.stringify({
                message: 'addAdditionalService: Additional service created successfully',
                additional_service_id: additionalService._id,
            }));
            await this.orderModel.findByIdAndUpdate(orderId, {
                $push: { additional_services: additionalService._id },
            });
            return additionalService;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'addAdditionalService: Error creating additional service',
                error: error.message,
            }));
            throw new common_1.HttpException('Server error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async addCustomization(orderId, body) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'addCustomization: Starting customization creation',
                orderId,
                body,
            }));
            const { cost, modules, product_id } = body;
            this.loggerService.log(JSON.stringify({
                message: 'addCustomization: Creating customization document',
                cost,
                modules,
                product_id,
                orderId,
            }));
            const customization = new this.customizationModel({
                ...body,
                order_id: orderId,
            });
            await customization.save();
            this.loggerService.log(JSON.stringify({
                message: 'addCustomization: Starting AMC cost update',
                orderId,
                customizationId: customization._id,
                customizationCost: cost,
            }));
            const amc = await this.amcModel.findOne({
                order_id: new mongoose_2.Types.ObjectId(orderId),
            });
            if (!amc) {
                throw new Error('AMC not found for this order');
            }
            const newTotalCost = amc.total_cost + cost;
            const newAmount = (newTotalCost / 100) * amc.amc_percentage;
            this.loggerService.log(JSON.stringify({
                message: 'addCustomization: AMC Calc completed',
                newTotalCost,
                newAmount,
                used: { percentage: amc.amc_percentage, total_cost: amc.total_cost },
            }));
            const amcUpdateResult = await this.amcModel.findByIdAndUpdate(amc._id, {
                total_cost: newTotalCost,
                amount: newAmount,
            }, { new: true });
            this.loggerService.log(JSON.stringify({
                message: 'addCustomization: AMC update completed',
                amcUpdateResult,
                orderId,
            }));
            const orderUpdate = await this.orderModel.findByIdAndUpdate(orderId, {
                $push: { customizations: customization._id },
            });
            this.loggerService.log(JSON.stringify({
                message: 'addCustomization: Process completed successfully',
                customizationId: customization._id,
                orderId,
                orderUpdateResult: orderUpdate,
            }));
            return customization;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'addCustomization: Error occurred',
                error: error.message,
                stack: error.stack,
                orderId,
                requestBody: body,
            }));
            throw new common_1.HttpException('Server error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async loadAllOrdersWithAttributes(page, limit) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getAllOrdersWithFilters: Fetching all orders',
            }));
            const orders = await this.orderModel
                .find()
                .sort({ _id: -1 })
                .populate([
                { path: 'licenses', model: license_schema_1.License.name },
                { path: 'customizations', model: customization_schema_1.Customization.name },
                { path: 'additional_services', model: additional_service_schema_1.AdditionalService.name },
                { path: 'products', model: product_schema_1.Product.name },
                { path: 'client_id', model: client_schema_1.Client.name },
            ]);
            const productsList = await this.productModel.find();
            let customizations = [], licenses = [], additional_services = [];
            const ordersList = orders.map((order) => {
                const orderObj = order.toObject();
                if (orderObj.is_purchased_with_order?.license &&
                    orderObj.licenses?.length) {
                    orderObj.license = orderObj.licenses[0];
                    orderObj.licenses.forEach((license) => (license.status = order.status));
                    licenses.push(...orderObj.licenses);
                    delete orderObj.licenses;
                }
                if (orderObj.is_purchased_with_order?.customization &&
                    orderObj.customizations?.length) {
                    orderObj.customization = orderObj.customizations[0];
                    orderObj.customizations.forEach((customization) => (customization.status = order.status));
                    customizations.push(...orderObj.customizations);
                    delete orderObj.customizations;
                }
                if (orderObj.purchase_order_document) {
                    orderObj.purchase_order_document = this.storageService.get(orderObj.purchase_order_document);
                }
                if (orderObj.agreements.length) {
                    for (let i = 0; i < orderObj.agreements.length; i++) {
                        orderObj.agreements[i].document = this.storageService.get(orderObj.agreements[i].document);
                    }
                }
                if (orderObj.additional_services?.length) {
                    orderObj.additional_services.forEach((service) => (service.status = order.status));
                    additional_services.push(...orderObj.additional_services);
                    delete orderObj.additional_services;
                }
                return orderObj;
            });
            const purchases = [
                ...ordersList.map((order) => ({
                    client: order.client_id || { name: 'Unknown' },
                    purchase_type: order_enum_1.PURCHASE_TYPE.ORDER,
                    products: order.products,
                    status: order.status,
                    amc_start_date: order?.amc_start_date || null,
                    id: order._id,
                })),
                ...licenses.map((license) => ({
                    client: orders.find((o) => o._id.toString() === license.order_id?.toString())?.client_id || { name: 'Unknown' },
                    purchase_type: order_enum_1.PURCHASE_TYPE.LICENSE,
                    products: [
                        productsList.find((p) => p._id.toString() === license.product_id?.toString()) || null,
                    ],
                    status: license.status,
                    id: license._id,
                })),
                ...customizations.map((customization) => ({
                    client: orders.find((o) => o._id.toString() === customization.order_id?.toString())?.client_id || { name: 'Unknown' },
                    purchase_type: order_enum_1.PURCHASE_TYPE.CUSTOMIZATION,
                    products: [
                        productsList.find((p) => p._id.toString() === customization.product_id?.toString()) || null,
                    ],
                    status: customization.status,
                    id: customization._id,
                })),
                ...additional_services.map((service) => ({
                    client: orders.find((o) => o._id.toString() === service.order_id?.toString())?.client_id || { name: 'Unknown' },
                    purchase_type: order_enum_1.PURCHASE_TYPE.ADDITIONAL_SERVICE,
                    products: [{ name: service.name || '' }],
                    status: service.status,
                    id: service._id,
                })),
            ];
            return { purchases };
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getAllOrdersWithFilters: Error fetching orders',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getAmcByOrderId(orderId) {
        if (!orderId) {
            this.loggerService.error(JSON.stringify({
                message: 'getAmcByOrderId: Order id is required',
            }));
            throw new common_1.HttpException('Order id is required', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getAmcByOrderId: Fetching AMC',
                orderId,
            }));
            const amc = await this.amcModel.findOne({ order_id: orderId }).populate([
                {
                    path: 'client_id',
                    select: 'name',
                },
                {
                    path: 'products',
                },
            ]);
            const amcObject = amc.toObject();
            amcObject['client'] = amcObject.client_id;
            delete amcObject.client_id;
            if (amc.purchase_order_document) {
                amcObject.purchase_order_document = this.storageService.get(amcObject.purchase_order_document);
            }
            else if (amc.invoice_document) {
                amcObject.invoice_document = this.storageService.get(amcObject.invoice_document);
            }
            if (!amc) {
                this.loggerService.error(JSON.stringify({
                    message: 'getAmcByOrderId: AMC not found',
                    orderId,
                }));
                throw new common_1.HttpException('AMC not found', common_1.HttpStatus.NOT_FOUND);
            }
            this.loggerService.log(JSON.stringify({
                message: 'getAmcByOrderId: AMC found successfully',
                orderId,
            }));
            return amcObject;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getAmcByOrderId: Error fetching AMC',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateAMC(orderId, body) {
        if (!orderId) {
            this.loggerService.error(JSON.stringify({
                message: 'updateAMC: Order id is required',
            }));
            throw new common_1.HttpException('Order id is required', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            this.loggerService.log(JSON.stringify({
                message: 'updateAMC: Updating AMC',
                orderId,
                body,
            }));
            const amc = await this.amcModel.findOne({ order_id: orderId }).populate({
                path: 'cliend_id',
                model: 'Client',
            });
            const amc_frequency_in_months = amc.client_id
                .amc_frequency_in_months;
            if (!amc) {
                this.loggerService.error(JSON.stringify({
                    message: 'updateAMC: AMC not found',
                    orderId,
                }));
                throw new common_1.HttpException('AMC not found', common_1.HttpStatus.NOT_FOUND);
            }
            const payload = {
                ...body,
                start_date: body.start_date
                    ? new Date(body.start_date)
                    : amc.start_date,
            };
            if (body.payments) {
                payload.payments = amc.payments.map((payment) => {
                    const updatedPayment = body.payments.find((p) => p._id.toString() === payment._id.toString());
                    return updatedPayment || payment;
                });
            }
            if (body.start_date !== amc.start_date.toString()) {
                const payments = [...payload.payments];
                const lastPayment = payments[payments.length - 1];
                const secondLastPayment = payments[payments.length - 2];
                if (lastPayment && lastPayment.status === amc_schema_1.PAYMENT_STATUS_ENUM.PENDING) {
                    const frequency = amc_frequency_in_months || order_enum_1.DEFAULT_AMC_CYCLE_IN_MONTHS;
                    let fromDate;
                    if (secondLastPayment) {
                        fromDate = secondLastPayment.to_date;
                    }
                    else {
                        const lastPaidPayment = [...payments]
                            .slice(0, -1)
                            .reverse()
                            .find((p) => p.status === amc_schema_1.PAYMENT_STATUS_ENUM.PAID);
                        fromDate = lastPaidPayment
                            ? lastPaidPayment.to_date
                            : payload.start_date;
                    }
                    lastPayment.from_date = fromDate;
                    lastPayment.to_date = this.getNextDate(new Date(fromDate), frequency);
                }
                payload.payments = payments;
            }
            const updatedAMC = await this.amcModel.findByIdAndUpdate(amc._id, {
                $set: payload,
            }, {
                new: true,
            });
            this.loggerService.log(JSON.stringify({
                message: 'updateAMC: AMC updated successfully',
                orderId,
            }));
            return updatedAMC;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'updateAMC: Error updating AMC',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getLicenseById(id) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getLicenseById: Fetching license',
                id,
            }));
            const license = await this.licenseModel.findById(id);
            const licenseObj = license.toObject();
            if (licenseObj.purchase_order_document) {
                licenseObj.purchase_order_document = this.storageService.get(licenseObj.purchase_order_document);
            }
            if (!license) {
                this.loggerService.error(JSON.stringify({
                    message: 'getLicenseById: License not found',
                    id,
                }));
                throw new common_1.HttpException('License not found', common_1.HttpStatus.NOT_FOUND);
            }
            this.loggerService.log(JSON.stringify({
                message: 'getLicenseById: License found successfully',
                id,
            }));
            return licenseObj;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getLicenseById: Error fetching license',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getAdditionalServiceById(id) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getAdditionalServiceById: Fetching additional service',
                id,
            }));
            const additionalService = await this.additionalServiceModel.findById(id);
            const additionalServiceObj = additionalService.toObject();
            if (additionalServiceObj.purchase_order_document) {
                additionalServiceObj.purchase_order_document = this.storageService.get(additionalServiceObj.purchase_order_document);
            }
            else if (additionalServiceObj.service_document) {
                additionalServiceObj.service_document = this.storageService.get(additionalServiceObj.service_document);
            }
            if (!additionalService) {
                this.loggerService.error(JSON.stringify({
                    message: 'getAdditionalServiceById: Additional service not found',
                    id,
                }));
            }
            return additionalServiceObj;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getAdditionalServiceById: Error fetching additional service',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getCustomizationById(id) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getCustomizationById: Fetching customization',
                id,
            }));
            const customization = await this.customizationModel.findById(id);
            if (!customization) {
                this.loggerService.error(JSON.stringify({
                    message: 'getCustomizationById: Customization not found',
                    id,
                }));
                throw new common_1.HttpException('Customization not found', common_1.HttpStatus.NOT_FOUND);
            }
            const customizationObj = customization.toObject();
            if (customizationObj.purchase_order_document) {
                customizationObj.purchase_order_document = this.storageService.get(customizationObj.purchase_order_document);
            }
            this.loggerService.log(JSON.stringify({
                message: 'getCustomizationById: Customization found successfully',
                id,
            }));
            return customizationObj;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getCustomizationById: Error fetching customization',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateAdditionalServiceById(id, body) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'updateAdditionalService: Updating additional service',
                id,
                body,
            }));
            const additionalService = await this.additionalServiceModel.findByIdAndUpdate(id, body, {
                new: true,
            });
            this.loggerService.log(JSON.stringify({
                message: 'updateAdditionalService: Additional service updated successfully',
                id,
            }));
            return additionalService;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'updateAdditionalService: Error updating additional service',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateCustomizationById(id, body) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'updateCustomization: Updating customization',
                id,
                body,
            }));
            const customization = await this.customizationModel.findByIdAndUpdate(id, body, { new: true });
            this.loggerService.log(JSON.stringify({
                message: 'updateCustomization: Customization updated successfully',
                id,
            }));
            return customization;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'updateCustomization: Error updating customization',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateLicenseById(id, body) {
        try {
            const { cost_per_license, product_id, total_license } = body;
            this.loggerService.log(JSON.stringify({
                message: 'updateLicense: Updating license',
                id,
                body,
            }));
            const license = await this.licenseModel.findByIdAndUpdate(id, {
                $set: {
                    'rate.amount': cost_per_license,
                    'rate.percentage': 0,
                    total_license,
                    product_id,
                    purchase_date: body.purchase_date,
                    purchase_order_document: body.purchase_order_document,
                    invoice: body.invoice,
                },
            }, {
                new: true,
            });
            this.loggerService.log(JSON.stringify({
                message: 'updateLicense: License updated successfully',
                id,
            }));
            return license;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'updateLicense: Error updating license',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async loadAllAMC(page, limit, filter, options = { upcoming: 1 }) {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'loadAllAMC: Fetching all AMC',
            }));
            let findFilter = {};
            switch (filter) {
                case order_enum_1.AMC_FILTER.ALL:
                    findFilter = {};
                    break;
                case order_enum_1.AMC_FILTER.UPCOMING:
                    const nextMonth = new Date();
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    findFilter = {
                        'payments.from_date': {
                            $gte: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 2),
                            $lte: new Date(nextMonth.getFullYear(), nextMonth.getMonth() + options.upcoming, 0),
                        },
                        'payments.status': amc_schema_1.PAYMENT_STATUS_ENUM.PENDING,
                    };
                    break;
                case order_enum_1.AMC_FILTER.PAID:
                    findFilter = {
                        $expr: {
                            $eq: [
                                { $arrayElemAt: ['$payments.status', -1] },
                                amc_schema_1.PAYMENT_STATUS_ENUM.PAID,
                            ],
                        },
                    };
                    break;
                case order_enum_1.AMC_FILTER.PENDING:
                    findFilter = {
                        $expr: {
                            $eq: [
                                { $arrayElemAt: ['$payments.status', -1] },
                                amc_schema_1.PAYMENT_STATUS_ENUM.PENDING,
                            ],
                        },
                    };
                    break;
                case order_enum_1.AMC_FILTER.OVERDUE:
                    findFilter = {
                        $expr: {
                            $and: [
                                {
                                    $lt: [
                                        { $arrayElemAt: ['$payments.to_date', -1] },
                                        new Date(),
                                    ],
                                },
                                {
                                    $eq: [
                                        { $arrayElemAt: ['$payments.status', -1] },
                                        amc_schema_1.PAYMENT_STATUS_ENUM.PENDING,
                                    ],
                                },
                            ],
                        },
                    };
                    break;
            }
            const amcs = await this.amcModel
                .find(findFilter)
                .sort({ _id: -1 })
                .populate([
                {
                    path: 'client_id',
                    model: client_schema_1.Client.name,
                },
                {
                    path: 'order_id',
                    model: product_order_schema_1.Order.name,
                },
                {
                    path: 'products',
                    model: product_schema_1.Product.name,
                },
            ]);
            this.loggerService.log(JSON.stringify({
                message: 'loadAllAMC: AMC fetched successfully',
            }));
            const amcsList = [];
            for (const amc of amcs) {
                const amcObj = amc.toObject();
                if (amc.payments.length <= 1 && filter !== order_enum_1.AMC_FILTER.FIRST)
                    continue;
                else if (amc.payments.length > 1 && filter === order_enum_1.AMC_FILTER.FIRST)
                    continue;
                if (amcObj.purchase_order_document) {
                    amcObj.purchase_order_document = this.storageService.get(amcObj.purchase_order_document);
                }
                else if (amcObj.invoice_document) {
                    amcObj.invoice_document = this.storageService.get(amcObj.invoice_document);
                }
                amcObj['client'] = amcObj.client_id;
                delete amcObj.client_id;
                amcObj['order'] = amcObj.order_id;
                delete amcObj.order_id;
                const lastPayment = amcObj.payments[amcObj.payments.length - 1];
                amcObj['last_payment'] = lastPayment;
                amcsList.push(amcObj);
            }
            return amcsList;
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'loadAllAMC: Error fetching AMC',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    getNextDate(fromDate, totalMonths) {
        const nextDate = new Date(fromDate);
        nextDate.setMonth(nextDate.getMonth() + totalMonths);
        return nextDate;
    }
    async updateAMCPayments() {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'updateAMCPayments: Starting AMC payments update process',
                timestamp: new Date().toISOString(),
            }));
            const amcs = await this.amcModel
                .find({
                payments: { $exists: true, $ne: [] },
            })
                .populate({
                path: 'client_id',
                select: 'amc_frequency_in_months',
            });
            this.loggerService.log(JSON.stringify({
                message: 'updateAMCPayments: Found AMCs to process',
                totalAMCs: amcs.length,
            }));
            const today = new Date();
            let updatedPaymentsCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            const updates = amcs.map(async (amc) => {
                try {
                    const amc_frequency_in_months = amc.client_id?.amc_frequency_in_months ||
                        order_enum_1.DEFAULT_AMC_CYCLE_IN_MONTHS;
                    const { payments, _id } = amc;
                    const lastPayment = payments[payments.length - 1];
                    this.loggerService.log(JSON.stringify({
                        message: 'updateAMCPayments: Processing AMC',
                        amcId: _id,
                        lastPaymentDate: lastPayment.to_date,
                        frequency: amc_frequency_in_months,
                    }));
                    if (today > new Date(lastPayment.to_date)) {
                        const newPayment = {
                            from_date: lastPayment.to_date,
                            to_date: this.getNextDate(lastPayment.to_date, amc_frequency_in_months),
                            status: amc_schema_1.PAYMENT_STATUS_ENUM.PENDING,
                        };
                        await this.amcModel.findByIdAndUpdate(_id, {
                            $push: { payments: newPayment },
                        });
                        this.loggerService.log(JSON.stringify({
                            message: 'updateAMCPayments: Added new payment',
                            amcId: _id,
                            newPayment,
                        }));
                        updatedPaymentsCount++;
                    }
                    else {
                        skippedCount++;
                        this.loggerService.log(JSON.stringify({
                            message: 'updateAMCPayments: Skipped AMC - payment not due',
                            amcId: _id,
                        }));
                    }
                }
                catch (error) {
                    errorCount++;
                    this.loggerService.error(JSON.stringify({
                        message: 'updateAMCPayments: Error processing individual AMC',
                        amcId: amc._id,
                        error: error.message,
                    }));
                }
            });
            await Promise.all(updates);
            this.loggerService.log(JSON.stringify({
                message: 'updateAMCPayments: Completed processing',
                summary: {
                    totalProcessed: amcs.length,
                    updated: updatedPaymentsCount,
                    skipped: skippedCount,
                    errors: errorCount,
                    completionTime: new Date().toISOString(),
                },
            }));
            return {
                processed: amcs.length,
                updated: updatedPaymentsCount,
                skipped: skippedCount,
                errors: errorCount,
            };
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'updateAMCPayments: Critical error in payment update process',
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            }));
            throw error;
        }
    }
    async deleteAllOrdersForAllClients() {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'deleteAllOrdersForAllClients: Starting deletion process for all clients',
            }));
            const clients = await this.clientModel.find();
            for (const client of clients) {
                const orders = client.orders;
                if (orders && orders.length > 0) {
                    for (const orderId of orders) {
                        try {
                            const order = await this.orderModel.findById(orderId);
                            if (order) {
                                if (order.licenses?.length) {
                                    await this.licenseModel.deleteMany({
                                        _id: { $in: order.licenses },
                                    });
                                }
                                if (order.customizations?.length) {
                                    await this.customizationModel.deleteMany({
                                        _id: { $in: order.customizations },
                                    });
                                }
                                if (order.additional_services?.length) {
                                    await this.additionalServiceModel.deleteMany({
                                        _id: { $in: order.additional_services },
                                    });
                                }
                                if (order.amc_id) {
                                    await this.amcModel.findByIdAndDelete(order.amc_id);
                                }
                                await this.orderModel.findByIdAndDelete(orderId);
                            }
                        }
                        catch (error) {
                            this.loggerService.error(JSON.stringify({
                                message: `Error deleting order ${orderId} for client ${client._id}`,
                                error: error.message,
                            }));
                        }
                    }
                    await this.clientModel.findByIdAndUpdate(client._id, {
                        $set: { orders: [], amcs: [] },
                    });
                }
            }
            this.loggerService.log(JSON.stringify({
                message: 'deleteAllOrdersForAllClients: Successfully completed deletion process',
            }));
            return {
                message: 'All orders and related documents deleted successfully',
            };
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'deleteAllOrdersForAllClients: Error during deletion process',
                error: error.message,
            }));
            throw new common_1.HttpException(error.message || 'Server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(product_order_schema_1.Order.name)),
    __param(1, (0, mongoose_1.InjectModel)(license_schema_1.License.name)),
    __param(2, (0, mongoose_1.InjectModel)(customization_schema_1.Customization.name)),
    __param(3, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __param(4, (0, mongoose_1.InjectModel)(client_schema_1.Client.name)),
    __param(5, (0, mongoose_1.InjectModel)(additional_service_schema_1.AdditionalService.name)),
    __param(6, (0, mongoose_1.InjectModel)(amc_schema_1.AMC.name)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, logger_service_1.LoggerService,
        storage_service_1.StorageService])
], OrderService);
//# sourceMappingURL=order.service.js.map