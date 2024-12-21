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
exports.ReportService = void 0;
const customization_schema_1 = require("../../../db/schema/order/customization.schema");
const license_schema_1 = require("../../../db/schema/order/license.schema");
const product_order_schema_1 = require("../../../db/schema/order/product-order.schema");
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const product_schema_1 = require("../../../db/schema/product.schema");
const logger_service_1 = require("../../../common/logger/services/logger.service");
const client_schema_1 = require("../../../db/schema/client.schema");
const additional_service_schema_1 = require("../../../db/schema/order/additional-service.schema");
const amc_schema_1 = require("../../../db/schema/amc/amc.schema");
let ReportService = class ReportService {
    constructor(orderModel, licenseModel, customizationModel, productModel, clientModel, additionalServiceModel, amcModel, loggerService) {
        this.orderModel = orderModel;
        this.licenseModel = licenseModel;
        this.customizationModel = customizationModel;
        this.productModel = productModel;
        this.clientModel = clientModel;
        this.additionalServiceModel = additionalServiceModel;
        this.amcModel = amcModel;
        this.loggerService = loggerService;
    }
    async getDetailedOverallSalesReport(filter, options) {
        try {
            let start;
            let end;
            switch (filter) {
                case 'monthly':
                    end = options?.endDate ? new Date(options.endDate) : new Date();
                    if (options?.year) {
                        start = new Date(options.year, 0, 1);
                        end = new Date(options.year, 11, 31);
                    }
                    else {
                        start = options?.startDate
                            ? new Date(options.startDate)
                            : new Date(new Date().setFullYear(end.getFullYear() - 1));
                    }
                    break;
                case 'yearly':
                    const year = options?.year || new Date().getFullYear();
                    start = new Date(year, 0, 1);
                    end = new Date(year, 11, 31);
                    break;
                case 'quarterly':
                    if (options?.quarter) {
                        const [quarter, year] = options.quarter.split(' ');
                        const quarterNumber = parseInt(quarter.replace('Q', ''));
                        start = new Date(parseInt(year), (quarterNumber - 1) * 3, 1);
                        end = new Date(parseInt(year), quarterNumber * 3, 0);
                    }
                    else {
                        const currentDate = new Date();
                        const currentQuarter = Math.floor(currentDate.getMonth() / 3);
                        start = new Date(currentDate.getFullYear(), currentQuarter * 3, 1);
                        end = new Date(currentDate.getFullYear(), (currentQuarter + 1) * 3, 0);
                    }
                    break;
                case 'all':
                    start = new Date(0);
                    end = new Date();
                    break;
            }
            const dateFilter = filter === 'all'
                ? {}
                : {
                    purchased_date: {
                        $gte: start,
                        $lte: end,
                    },
                };
            const [orders, customizations, licenses, additionalServices, amcs] = await Promise.all([
                this.orderModel.find(dateFilter),
                this.customizationModel.find(dateFilter),
                this.licenseModel.find(dateFilter),
                this.additionalServiceModel.find(dateFilter),
                this.amcModel.find(),
            ]);
            const groupByPeriod = (date) => {
                switch (filter) {
                    case 'monthly':
                        return date.toLocaleString('default', {
                            year: 'numeric',
                            month: 'long',
                        });
                    case 'quarterly':
                        return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
                    case 'yearly':
                        return date.getFullYear().toString();
                    default:
                        return 'All Time';
                }
            };
            const salesMap = new Map();
            orders.forEach((order) => {
                const period = groupByPeriod(new Date(order.purchased_date));
                const existing = salesMap.get(period) || {
                    orderRevenue: 0,
                    customizationRevenue: 0,
                    licenseRevenue: 0,
                    additionalServiceRevenue: 0,
                    amcRevenue: 0,
                    total: 0,
                };
                existing.orderRevenue += order.base_cost || 0;
                existing.total += order.base_cost || 0;
                salesMap.set(period, existing);
            });
            customizations.forEach((customization) => {
                const period = groupByPeriod(new Date(customization.purchased_date));
                const existing = salesMap.get(period) || {
                    orderRevenue: 0,
                    customizationRevenue: 0,
                    licenseRevenue: 0,
                    additionalServiceRevenue: 0,
                    amcRevenue: 0,
                    total: 0,
                };
                existing.customizationRevenue += customization.cost || 0;
                existing.total += customization.cost || 0;
                salesMap.set(period, existing);
            });
            licenses.forEach((license) => {
                const period = groupByPeriod(new Date(license.purchase_date));
                const existing = salesMap.get(period) || {
                    orderRevenue: 0,
                    customizationRevenue: 0,
                    licenseRevenue: 0,
                    additionalServiceRevenue: 0,
                    amcRevenue: 0,
                    total: 0,
                };
                const licenseRevenue = (license.rate?.amount || 0) * (license.total_license || 0);
                existing.licenseRevenue += licenseRevenue;
                existing.total += licenseRevenue;
                salesMap.set(period, existing);
            });
            additionalServices.forEach((service) => {
                const period = groupByPeriod(new Date(service.date.start));
                const existing = salesMap.get(period) || {
                    orderRevenue: 0,
                    customizationRevenue: 0,
                    licenseRevenue: 0,
                    additionalServiceRevenue: 0,
                    amcRevenue: 0,
                    total: 0,
                };
                existing.additionalServiceRevenue += service.cost || 0;
                existing.total += service.cost || 0;
                salesMap.set(period, existing);
            });
            amcs.forEach((amc) => {
                if (amc.payments.length > 1) {
                    amc.payments.slice(1).forEach((payment) => {
                        if (payment.status === amc_schema_1.PAYMENT_STATUS_ENUM.PAID &&
                            payment.from_date <= end) {
                            const period = groupByPeriod(new Date(payment.from_date));
                            const existing = salesMap.get(period) || {
                                orderRevenue: 0,
                                customizationRevenue: 0,
                                licenseRevenue: 0,
                                additionalServiceRevenue: 0,
                                amcRevenue: 0,
                                total: 0,
                            };
                            existing.amcRevenue += amc.amount || 0;
                            existing.total += amc.amount || 0;
                            salesMap.set(period, existing);
                        }
                    });
                }
            });
            return Array.from(salesMap.entries())
                .map(([period, data]) => ({
                period,
                ...data,
            }))
                .sort((a, b) => {
                if (filter === 'all')
                    return 0;
                return new Date(a.period).getTime() - new Date(b.period).getTime();
            });
        }
        catch (error) {
            this.loggerService.error(error);
            throw new common_1.HttpException('Internal Server Error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getAMCRevenueReport(filter, options) {
        try {
            let start;
            let end;
            switch (filter) {
                case 'monthly':
                    end = options?.endDate ? new Date(options.endDate) : new Date();
                    start = options?.startDate
                        ? new Date(options.startDate)
                        : new Date(new Date().setFullYear(end.getFullYear() - 1));
                    break;
                case 'yearly':
                    const year = options?.year || new Date().getFullYear();
                    start = new Date(year, 0, 1);
                    end = new Date(year, 11, 31);
                    break;
                case 'quarterly':
                    let quarterStartMonth = 0;
                    let quarterEndMonth = 2;
                    let qYear = new Date().getFullYear();
                    if (options?.quarter) {
                        const [q, qYearStr] = options.quarter.split(' ');
                        const quarterNumber = parseInt(q.replace('Q', ''));
                        qYear = parseInt(qYearStr);
                        quarterStartMonth = (quarterNumber - 1) * 3;
                        quarterEndMonth = quarterStartMonth + 2;
                    }
                    else {
                        const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
                        quarterStartMonth = (currentQuarter - 1) * 3;
                        quarterEndMonth = quarterStartMonth + 2;
                    }
                    start = new Date(qYear, quarterStartMonth, 1);
                    end = new Date(qYear, quarterEndMonth + 1, 0, 23, 59, 59);
                    break;
                case 'all':
                    start = new Date(0);
                    end = new Date();
                    break;
            }
            const groupByPeriod = (date) => {
                switch (filter) {
                    case 'monthly':
                        return date.toLocaleString('default', {
                            year: 'numeric',
                            month: 'long',
                        });
                    case 'quarterly':
                        return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
                    case 'yearly':
                        return date.getFullYear().toString();
                    default:
                        return 'All Time';
                }
            };
            const amcs = await this.amcModel.find();
            const revenueMap = new Map();
            amcs.forEach((amc) => {
                if (amc.payments.length > 1) {
                    const payments = amc.payments.slice(1);
                    payments.forEach((payment) => {
                        if (payment.status === amc_schema_1.PAYMENT_STATUS_ENUM.PAID) {
                            const paymentDate = new Date(payment.from_date);
                            if (paymentDate >= start && paymentDate <= end) {
                                const period = groupByPeriod(paymentDate);
                                const existingRevenue = revenueMap.get(period) || 0;
                                revenueMap.set(period, existingRevenue + (amc.amount || 0));
                            }
                        }
                    });
                }
            });
            const result = Array.from(revenueMap.entries())
                .map(([period, total]) => ({
                period,
                total,
            }))
                .sort((a, b) => {
                if (filter === 'all')
                    return 0;
                if (filter === 'monthly') {
                    const dateA = new Date(a.period);
                    const dateB = new Date(b.period);
                    return dateA.getTime() - dateB.getTime();
                }
                else if (filter === 'yearly') {
                    return parseInt(a.period) - parseInt(b.period);
                }
                else if (filter === 'quarterly') {
                    const [qA, yA] = a.period.split(' ');
                    const [qB, yB] = b.period.split(' ');
                    const yearDiff = parseInt(yA) - parseInt(yB);
                    if (yearDiff !== 0)
                        return yearDiff;
                    return (parseInt(qA.replace('Q', '')) - parseInt(qB.replace('Q', '')));
                }
                return 0;
            });
            return result.length > 0 ? result : [{ period: 'All Time', total: 0 }];
        }
        catch (error) {
            this.loggerService.error(error);
            throw new common_1.HttpException('Internal Server Error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getProductWiseRevenueDistribution(filter, options) {
        try {
            let start;
            let end;
            switch (filter) {
                case 'monthly':
                    end = options?.endDate ? new Date(options.endDate) : new Date();
                    start = options?.startDate
                        ? new Date(options.startDate)
                        : new Date(new Date().setFullYear(end.getFullYear() - 1));
                    break;
                case 'yearly':
                    const year = options?.year || new Date().getFullYear();
                    start = new Date(year, 0, 1);
                    end = new Date(year, 11, 31);
                    break;
                case 'quarterly':
                    if (options?.quarter) {
                        const [quarter, yearStr] = options.quarter.split(' ');
                        const quarterNumber = parseInt(quarter.replace('Q', ''));
                        start = new Date(parseInt(yearStr), (quarterNumber - 1) * 3, 1);
                        end = new Date(parseInt(yearStr), quarterNumber * 3, 0);
                    }
                    else {
                        const currentDate = new Date();
                        const currentQuarter = Math.floor(currentDate.getMonth() / 3);
                        start = new Date(currentDate.getFullYear(), currentQuarter * 3, 1);
                        end = new Date(currentDate.getFullYear(), (currentQuarter + 1) * 3, 0);
                    }
                    break;
                case 'all':
                    start = new Date(0);
                    end = new Date();
                    break;
            }
            const dateFilter = filter === 'all'
                ? {}
                : {
                    purchased_date: {
                        $gte: start,
                        $lte: end,
                    },
                };
            const orders = await this.orderModel
                .find(dateFilter)
                .populate('products')
                .lean();
            const productsRevenueMap = new Map();
            for (const order of orders) {
                if (!order.products || order.products.length === 0)
                    continue;
                const productIds = order.products.map((p) => p.toString());
                const productRevenues = new Map();
                if (order.products.length === 1) {
                    const productId = productIds[0];
                    productRevenues.set(productId, order.base_cost || 0);
                }
                else {
                    if (order.base_cost_seperation &&
                        order.base_cost_seperation.length > 0) {
                        order.base_cost_seperation.forEach((sep) => {
                            const productId = sep.product_id.toString();
                            const amount = sep.amount || 0;
                            productRevenues.set(productId, amount);
                        });
                    }
                    else {
                        const amountPerProduct = (order.base_cost || 0) / order.products.length;
                        productIds.forEach((productId) => {
                            productRevenues.set(productId, amountPerProduct);
                        });
                    }
                }
                for (const [productId, revenue] of productRevenues.entries()) {
                    const existing = productsRevenueMap.get(productId) || {
                        product: null,
                        revenue: 0,
                    };
                    existing.revenue += revenue;
                    if (!existing.product) {
                        const product = await this.productModel.findById(productId).lean();
                        existing.product = product;
                    }
                    productsRevenueMap.set(productId, existing);
                }
            }
            const customizations = await this.customizationModel
                .find({
                purchased_date: { $gte: start, $lte: end },
            })
                .lean();
            for (const customization of customizations) {
                const productId = customization.product_id.toString();
                const existing = productsRevenueMap.get(productId) || {
                    product: null,
                    revenue: 0,
                };
                existing.revenue += customization.cost || 0;
                if (!existing.product) {
                    const product = await this.productModel.findById(productId).lean();
                    existing.product = product;
                }
                productsRevenueMap.set(productId, existing);
            }
            const licenses = await this.licenseModel
                .find({
                purchase_date: { $gte: start, $lte: end },
            })
                .lean();
            for (const license of licenses) {
                const productId = license.product_id.toString();
                const licenseRevenue = (license.rate?.amount || 0) * (license.total_license || 0);
                const existing = productsRevenueMap.get(productId) || {
                    product: null,
                    revenue: 0,
                };
                existing.revenue += licenseRevenue;
                if (!existing.product) {
                    const product = await this.productModel.findById(productId).lean();
                    existing.product = product;
                }
                productsRevenueMap.set(productId, existing);
            }
            const additionalServices = await this.additionalServiceModel
                .find({
                'date.start': { $gte: start, $lte: end },
            })
                .lean();
            for (const service of additionalServices) {
                const productId = service.product_id.toString();
                const existing = productsRevenueMap.get(productId) || {
                    product: null,
                    revenue: 0,
                };
                existing.revenue += service.cost || 0;
                if (!existing.product) {
                    const product = await this.productModel.findById(productId).lean();
                    existing.product = product;
                }
                productsRevenueMap.set(productId, existing);
            }
            const amcs = await this.amcModel.find().lean();
            for (const amc of amcs) {
                if (amc.payments.length > 1) {
                    const order = await this.orderModel
                        .findById(amc.order_id)
                        .populate('products')
                        .lean();
                    if (!order || !order.products)
                        continue;
                    const productIds = order.products.map((p) => p.toString());
                    for (const payment of amc.payments.slice(1)) {
                        if (payment.status === amc_schema_1.PAYMENT_STATUS_ENUM.PAID &&
                            payment.from_date >= start &&
                            payment.from_date <= end) {
                            const amcAmount = amc.amount || 0;
                            const productAmcAmounts = new Map();
                            if (order.products.length === 1) {
                                const productId = productIds[0];
                                productAmcAmounts.set(productId, amcAmount);
                            }
                            else {
                                if (order.base_cost_seperation &&
                                    order.base_cost_seperation.length > 0) {
                                    const totalPercentage = order.base_cost_seperation.reduce((sum, sep) => sum + (sep.percentage || 0), 0);
                                    order.base_cost_seperation.forEach((sep) => {
                                        const productId = sep.product_id.toString();
                                        const percentage = sep.percentage || 0;
                                        const amount = (percentage / totalPercentage) * amcAmount;
                                        productAmcAmounts.set(productId, amount);
                                    });
                                }
                                else {
                                    const amountPerProduct = amcAmount / order.products.length;
                                    productIds.forEach((productId) => {
                                        productAmcAmounts.set(productId, amountPerProduct);
                                    });
                                }
                            }
                            for (const [productId, amount] of productAmcAmounts.entries()) {
                                const existing = productsRevenueMap.get(productId) || {
                                    product: null,
                                    revenue: 0,
                                };
                                existing.revenue += amount;
                                if (!existing.product) {
                                    const product = await this.productModel
                                        .findById(productId)
                                        .lean();
                                    existing.product = product;
                                }
                                productsRevenueMap.set(productId, existing);
                            }
                        }
                    }
                }
            }
            const productsRevenueArray = Array.from(productsRevenueMap.values()).filter((pr) => pr.product);
            productsRevenueArray.sort((a, b) => b.revenue - a.revenue);
            const totalRevenue = productsRevenueArray.reduce((sum, pr) => sum + pr.revenue, 0);
            let cumulativeRevenue = 0;
            productsRevenueArray.forEach((pr) => {
                pr.percentage = (pr.revenue / totalRevenue) * 100;
                cumulativeRevenue += pr.percentage;
                pr.cumulativePercentage = cumulativeRevenue;
            });
            return productsRevenueArray.map((pr) => ({
                productId: pr.product._id,
                productName: pr.product.name,
                revenue: pr.revenue,
                percentage: pr.percentage,
                cumulativePercentage: pr.cumulativePercentage,
            }));
        }
        catch (error) {
            console.log({ error });
            this.loggerService.error(error);
            throw new common_1.HttpException('Internal Server Error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getAMCAnnualBreakdown(filter, options) {
        try {
            let start;
            let end;
            switch (filter) {
                case 'monthly':
                    end = options?.endDate ? new Date(options.endDate) : new Date();
                    start = options?.startDate
                        ? new Date(options.startDate)
                        : new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());
                    break;
                case 'yearly':
                    const year = options?.year || new Date().getFullYear();
                    start = new Date(year, 0, 1);
                    end = new Date(year, 11, 31, 23, 59, 59);
                    break;
                case 'quarterly':
                    if (options?.quarter) {
                        const [qStr, qYearStr] = options.quarter.split(' ');
                        const qNum = parseInt(qStr.replace('Q', ''));
                        const qYear = parseInt(qYearStr);
                        const quarterStartMonth = (qNum - 1) * 3;
                        start = new Date(qYear, quarterStartMonth, 1);
                        end = new Date(qYear, quarterStartMonth + 3, 0, 23, 59, 59);
                    }
                    else {
                        const currentDate = new Date();
                        const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
                        const quarterStartMonth = (currentQuarter - 1) * 3;
                        start = new Date(currentDate.getFullYear(), quarterStartMonth, 1);
                        end = new Date(currentDate.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59);
                    }
                    break;
                case 'all':
                    start = new Date(0);
                    end = new Date();
                    break;
                default:
                    start = new Date(new Date().getFullYear(), 0, 1);
                    end = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);
            }
            console.log({ start, end, filter, options });
            const groupByPeriod = (date) => {
                switch (filter) {
                    case 'monthly':
                        return date.toLocaleString('default', {
                            year: 'numeric',
                            month: 'long',
                        });
                    case 'quarterly':
                        return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
                    case 'yearly':
                        return date.getFullYear().toString();
                    default:
                        return 'All Time';
                }
            };
            const productId = options?.productId;
            let amcQuery = {};
            if (productId) {
                const orders = await this.orderModel
                    .find({ products: productId })
                    .lean();
                const orderIds = orders.map((order) => order._id);
                amcQuery = { order_id: { $in: orderIds } };
            }
            const amcs = await this.amcModel.find(amcQuery).lean();
            const breakdownMap = new Map();
            for (const amc of amcs) {
                const payments = amc.payments.slice(1);
                for (const payment of payments) {
                    const paymentDate = new Date(payment.from_date);
                    if (paymentDate >= start && paymentDate <= end) {
                        const period = groupByPeriod(paymentDate);
                        const existing = breakdownMap.get(period) || {
                            totalExpected: 0,
                            totalCollected: 0,
                        };
                        existing.totalExpected += amc.amount || 0;
                        if (payment.status === amc_schema_1.PAYMENT_STATUS_ENUM.PAID) {
                            existing.totalCollected += amc.amount || 0;
                        }
                        breakdownMap.set(period, existing);
                    }
                }
            }
            const result = Array.from(breakdownMap.entries())
                .map(([period, data]) => ({
                period,
                ...data,
            }))
                .sort((a, b) => {
                if (filter === 'all')
                    return 0;
                if (filter === 'monthly') {
                    const dateA = new Date(a.period);
                    const dateB = new Date(b.period);
                    return dateA.getTime() - dateB.getTime();
                }
                else if (filter === 'yearly') {
                    return parseInt(a.period) - parseInt(b.period);
                }
                else if (filter === 'quarterly') {
                    const [qA, yA] = a.period.split(' ');
                    const [qB, yB] = b.period.split(' ');
                    const yearDiff = parseInt(yA) - parseInt(yB);
                    if (yearDiff !== 0)
                        return yearDiff;
                    return (parseInt(qA.replace('Q', '')) - parseInt(qB.replace('Q', '')));
                }
                return 0;
            });
            return result;
        }
        catch (error) {
            this.loggerService.error(error);
            throw new common_1.HttpException('Internal Server Error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getIndustryWiseRevenueDistribution(filter, options) {
        try {
            let start;
            let end;
            switch (filter) {
                case 'monthly':
                    if (options?.month && options?.year) {
                        start = new Date(options.year, options.month - 1, 1);
                        end = new Date(options.year, options.month, 0, 23, 59, 59);
                    }
                    else {
                        const now = new Date();
                        const month = now.getMonth();
                        const year = now.getFullYear();
                        start = new Date(year, month, 1);
                        end = new Date(year, month + 1, 0, 23, 59, 59);
                    }
                    break;
                case 'yearly':
                    const year = options?.year || new Date().getFullYear();
                    start = new Date(year, 0, 1);
                    end = new Date(year, 11, 31, 23, 59, 59);
                    break;
                case 'quarterly':
                    if (options?.quarter) {
                        const [qStr, qYearStr] = options.quarter.split(' ');
                        const quarterNumber = parseInt(qStr.replace('Q', ''));
                        const qYear = parseInt(qYearStr);
                        const quarterStartMonth = (quarterNumber - 1) * 3;
                        start = new Date(qYear, quarterStartMonth, 1);
                        end = new Date(qYear, quarterStartMonth + 3, 0, 23, 59, 59);
                    }
                    else {
                        const currentDate = new Date();
                        const currentQuarter = Math.floor(currentDate.getMonth() / 3);
                        const quarterStartMonth = currentQuarter * 3;
                        start = new Date(currentDate.getFullYear(), quarterStartMonth, 1);
                        end = new Date(currentDate.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59);
                    }
                    break;
                case 'all':
                    start = new Date(0);
                    end = new Date();
                    break;
                default:
                    start = new Date(new Date().getFullYear(), 0, 1);
                    end = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);
            }
            const dateQuery = filter === 'all' ? {} : {
                purchased_date: {
                    $gte: start,
                    $lte: end
                }
            };
            let productFilter = {};
            if (options?.productId) {
                productFilter = { products: options.productId };
            }
            const [orders, customizations, licenses, additionalServices, amcs] = await Promise.all([
                this.orderModel
                    .find({ ...dateQuery, ...productFilter })
                    .populate('client_id')
                    .lean(),
                this.customizationModel
                    .find({
                    purchased_date: filter === 'all' ? undefined : { $gte: start, $lte: end }
                })
                    .populate({
                    path: 'order_id',
                    match: productFilter,
                    populate: { path: 'client_id' },
                })
                    .lean(),
                this.licenseModel
                    .find({
                    purchase_date: filter === 'all' ? undefined : { $gte: start, $lte: end }
                })
                    .populate({
                    path: 'order_id',
                    match: productFilter,
                    populate: { path: 'client_id' },
                })
                    .lean(),
                this.additionalServiceModel
                    .find({
                    'date.start': filter === 'all' ? undefined : { $gte: start, $lte: end }
                })
                    .populate({
                    path: 'order_id',
                    match: productFilter,
                    populate: { path: 'client_id' },
                })
                    .lean(),
                this.amcModel.find().lean(),
            ]);
            const groupByPeriod = (date) => {
                switch (filter) {
                    case 'monthly':
                        return date.toLocaleString('default', {
                            year: 'numeric',
                            month: 'long',
                        });
                    case 'quarterly':
                        return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
                    case 'yearly':
                        return date.getFullYear().toString();
                    default:
                        return 'All Time';
                }
            };
            const industryRevenueMap = new Map();
            const addRevenue = (industry, period, amount) => {
                if (!industryRevenueMap.has(industry)) {
                    industryRevenueMap.set(industry, {});
                }
                const periodRevenue = industryRevenueMap.get(industry);
                if (!periodRevenue[period]) {
                    periodRevenue[period] = 0;
                }
                periodRevenue[period] += amount;
            };
            for (const order of orders) {
                if (!order.client_id)
                    continue;
                const period = groupByPeriod(new Date(order.purchased_date));
                const industry = order.client_id.industry || 'Unknown';
                const amount = order.base_cost || 0;
                addRevenue(industry, period, amount);
            }
            for (const customization of customizations) {
                const period = groupByPeriod(new Date(customization.purchased_date));
                const order = customization.order_id;
                if (!order || !order.client_id)
                    continue;
                const industry = order.client_id.industry || 'Unknown';
                const amount = customization.cost || 0;
                addRevenue(industry, period, amount);
            }
            for (const license of licenses) {
                const period = groupByPeriod(new Date(license.purchase_date));
                const order = license.order_id;
                if (!order || !order.client_id)
                    continue;
                const industry = order.client_id.industry || 'Unknown';
                const licenseRevenue = (license.rate?.amount || 0) * (license.total_license || 0);
                addRevenue(industry, period, licenseRevenue);
            }
            for (const service of additionalServices) {
                const period = groupByPeriod(new Date(service.date.start));
                const order = service.order_id;
                if (!order || !order.client_id)
                    continue;
                const industry = order.client_id.industry || 'Unknown';
                const amount = service.cost || 0;
                addRevenue(industry, period, amount);
            }
            for (const amc of amcs) {
                if (amc.payments.length > 1) {
                    for (const payment of amc.payments.slice(1)) {
                        if (payment.status === amc_schema_1.PAYMENT_STATUS_ENUM.PAID &&
                            payment.from_date >= start &&
                            payment.from_date <= end) {
                            const period = groupByPeriod(new Date(payment.from_date));
                            const client = await this.clientModel
                                .findById(amc.client_id)
                                .lean();
                            const industry = client?.industry || 'Unknown';
                            const amount = amc.amount || 0;
                            addRevenue(industry, period, amount);
                        }
                    }
                }
            }
            const result = [];
            for (const [industry, periods] of industryRevenueMap.entries()) {
                for (const [period, revenue] of Object.entries(periods)) {
                    result.push({
                        period,
                        industry,
                        revenue,
                    });
                }
            }
            result.sort((a, b) => {
                if (a.period === b.period) {
                    return a.industry.localeCompare(b.industry);
                }
                if (filter === 'monthly') {
                    const dateA = new Date(a.period);
                    const dateB = new Date(b.period);
                    return dateA.getTime() - dateB.getTime();
                }
                else if (filter === 'quarterly') {
                    const [qA, yA] = a.period.split(' ');
                    const [qB, yB] = b.period.split(' ');
                    const yearDiff = parseInt(yA) - parseInt(yB);
                    if (yearDiff !== 0)
                        return yearDiff;
                    return parseInt(qA.replace('Q', '')) - parseInt(qB.replace('Q', ''));
                }
                else if (filter === 'yearly') {
                    return parseInt(a.period) - parseInt(b.period);
                }
                return 0;
            });
            return result;
        }
        catch (error) {
            this.loggerService.error(error);
            throw new common_1.HttpException('Internal Server Error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.ReportService = ReportService;
exports.ReportService = ReportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(product_order_schema_1.Order.name)),
    __param(1, (0, mongoose_1.InjectModel)(license_schema_1.License.name)),
    __param(2, (0, mongoose_1.InjectModel)(customization_schema_1.Customization.name)),
    __param(3, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __param(4, (0, mongoose_1.InjectModel)(client_schema_1.Client.name)),
    __param(5, (0, mongoose_1.InjectModel)(additional_service_schema_1.AdditionalService.name)),
    __param(6, (0, mongoose_1.InjectModel)(amc_schema_1.AMC.name)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, logger_service_1.LoggerService])
], ReportService);
//# sourceMappingURL=report.service.js.map