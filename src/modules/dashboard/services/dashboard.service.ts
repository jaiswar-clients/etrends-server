import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { PipelineStage } from 'mongoose';
import {
  Customization,
  CustomizationDocument,
} from '@/db/schema/order/customization.schema';
import { License, LicenseDocument } from '@/db/schema/order/license.schema';
import { Order, OrderDocument } from '@/db/schema/order/product-order.schema';
import { Product, ProductDocument } from '@/db/schema/product.schema';
import { Client, ClientDocument } from '@/db/schema/client.schema';
import {
  AdditionalService,
  AdditionalServiceDocument,
} from '@/db/schema/order/additional-service.schema';
import {
  AMC,
  AMCDocument,
  PAYMENT_STATUS_ENUM,
} from '@/db/schema/amc/amc.schema';
import { FilterPreset, FilterPresetDocument } from '@/db/schema/filter-preset.schema';
import { DashboardFiltersDto } from '../dto/dashboard-filters.dto';
import { DashboardResponseDto } from '../dto/dashboard-response.dto';
import {
  DashboardSummaryDto,
  DashboardTrendsDto,
  DashboardDistributionsDto,
  TopPerformersDto,
} from '../dto/dashboard-response.dto';
import { DrillDownFiltersDto } from '../dto/drilldown-filters.dto';
import { DrillDownResponseDto } from '../dto/drilldown-response.dto';
import { FilterOptionsResponseDto } from '../dto/filter-options.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Order.name)
    private orderModel: SoftDeleteModel<OrderDocument>,
    @InjectModel(License.name)
    private licenseModel: SoftDeleteModel<LicenseDocument>,
    @InjectModel(Customization.name)
    private customizationModel: SoftDeleteModel<CustomizationDocument>,
    @InjectModel(Product.name)
    private productModel: SoftDeleteModel<ProductDocument>,
    @InjectModel(Client.name)
    private clientModel: SoftDeleteModel<ClientDocument>,
    @InjectModel(AdditionalService.name)
    private additionalServiceModel: SoftDeleteModel<AdditionalServiceDocument>,
    @InjectModel(AMC.name)
    private amcModel: SoftDeleteModel<AMCDocument>,
    @InjectModel(FilterPreset.name)
    private filterPresetModel: SoftDeleteModel<FilterPresetDocument>,
  ) {}

  async getDashboardData(filters: DashboardFiltersDto): Promise<DashboardResponseDto> {
    const dateRange = this.calculateDateRange(filters.filter, {
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    const [
      orderRevenue,
      amcRevenue,
      customizationRevenue,
      licenseRevenue,
      serviceRevenue,
    ] = await Promise.all([
      this.getOrderRevenue(dateRange, filters),
      this.getAMCRevenue(dateRange, filters),
      this.getCustomizationRevenue(dateRange, filters),
      this.getLicenseRevenue(dateRange, filters),
      this.getServiceRevenue(dateRange, filters),
    ]);

    const totalRevenue = orderRevenue + amcRevenue + customizationRevenue + licenseRevenue + serviceRevenue;

    const summary: DashboardSummaryDto = {
      totalRevenue,
      amcRevenue,
      newBusinessRevenue: orderRevenue,
      customizationRevenue,
      licenseRevenue,
      additionalServiceRevenue: serviceRevenue,
      pendingPayments: 0,
      paidPayments: 0,
      totalClients: 0,
      totalOrders: 0,
      revenueGrowth: 0,
      period: filters.fiscalYear
        ? `FY${(filters.fiscalYear % 100).toString().padStart(2, '0')}-${((filters.fiscalYear + 1) % 100).toString().padStart(2, '0')}`
        : 'Custom Range',
    };

    return {
      summary,
      trends: await this.getDashboardTrends(filters),
      distributions: await this.getDashboardDistributions(filters),
      topPerformers: await this.getTopPerformers(filters),
    };
  }

  async getDrillDownData(filters: DrillDownFiltersDto): Promise<DrillDownResponseDto> {
    const dateRange = this.calculateDateRange(filters.filter, {
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    const metadata = {
      drilldownType: filters.drilldownType,
      drilldownValue: filters.drilldownValue || 'All',
      period: filters.fiscalYear
        ? `FY${(filters.fiscalYear % 100).toString().padStart(2, '0')}-${((filters.fiscalYear + 1) % 100).toString().padStart(2, '0')}`
        : 'Custom Range',
      totalRecords: 0,
    };

    let aggregatedData: any[] = [];

    switch (filters.drilldownType) {
      case 'product':
        aggregatedData = await this.getProductDrillDown(filters, dateRange);
        break;
      case 'client':
        aggregatedData = await this.getClientDrillDown(filters, dateRange);
        break;
      case 'industry':
        aggregatedData = await this.getIndustryDrillDown(filters, dateRange);
        break;
      case 'time':
        aggregatedData = await this.getTimeDrillDown(filters, dateRange);
        break;
      case 'amc':
        aggregatedData = await this.getAMCDrillDown(filters, dateRange);
        break;
      default:
        aggregatedData = [];
    }

    let details: any[] | undefined;

    if (filters.includeDetails) {
      details = await this.getTransactionDetails(filters, dateRange);
      metadata.totalRecords = details.length;
    }

    return {
      metadata,
      aggregatedData,
      details,
      pagination: filters.includeDetails ? {
        page: filters.page || 1,
        limit: filters.limit || 20,
        total: metadata.totalRecords,
        totalPages: Math.ceil(metadata.totalRecords / (filters.limit || 20)),
      } : undefined,
    };
  }

  async getFilterOptions(): Promise<FilterOptionsResponseDto> {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const fiscalYearStart = currentMonth < 3 ? currentYear - 1 : currentYear;

    const fiscalYears = [];
    for (let i = fiscalYearStart; i >= fiscalYearStart - 15; i--) {
      const endYear = i + 1;
      fiscalYears.push({
        value: i.toString(),
        label: `FY${(i % 100).toString().padStart(2, '0')}-${(endYear % 100).toString().padStart(2, '0')}`,
      });
    }

    const fyLabel = `${(fiscalYearStart % 100).toString().padStart(2, '0')}-${((fiscalYearStart + 1) % 100).toString().padStart(2, '0')}`;
    const quarters = [
      { value: `Q1 ${fiscalYearStart}`, label: `Q1 FY${fyLabel} (Apr-Jun)` },
      { value: `Q2 ${fiscalYearStart}`, label: `Q2 FY${fyLabel} (Jul-Sep)` },
      { value: `Q3 ${fiscalYearStart}`, label: `Q3 FY${fyLabel} (Oct-Dec)` },
      { value: `Q4 ${fiscalYearStart}`, label: `Q4 FY${fyLabel} (Jan-Mar)` },
    ];

    const [clients, products, industries] = await Promise.all([
      this.clientModel.find().select('_id name').lean().then(docs => 
        docs.map((c: any) => ({ value: c._id.toString(), label: c.name }))
      ),
      this.productModel.find().select('_id name').lean().then(docs =>
        docs.map((p: any) => ({ value: p._id.toString(), label: p.name }))
      ),
      this.clientModel.distinct('industry').lean().then(items =>
        items.filter(Boolean).map((i: any) => ({ value: i, label: i }))
      ),
    ]);

    const revenueStreams = [
      { value: 'order', label: 'Orders' },
      { value: 'amc', label: 'AMC' },
      { value: 'customization', label: 'Customization' },
      { value: 'license', label: 'License' },
      { value: 'service', label: 'Additional Services' },
    ];

    const paymentStatuses = [
      { value: 'paid', label: 'Paid' },
      { value: 'pending', label: 'Pending' },
      { value: 'proforma', label: 'Proforma' },
      { value: 'invoice', label: 'Invoice' },
    ];

    return {
      fiscalYears,
      quarters,
      clients,
      products,
      industries,
      revenueStreams,
      paymentStatuses,
    };
  }

  private calculateDateRange(
    filter: string,
    options?: { year?: number; quarter?: string },
  ): { startDate: Date; endDate: Date } {
    let start: Date;
    let end: Date;

    switch (filter) {
      case 'monthly':
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'yearly':
        const fiscalYear = options?.year || new Date().getFullYear();
        start = new Date(fiscalYear, 3, 1);
        end = new Date(fiscalYear + 1, 2, 31, 23, 59, 59);
        break;
      case 'quarterly':
        if (options?.quarter) {
          const [qStr, qYearStr] = options.quarter.split(' ');
          const quarterNumber = parseInt(qStr.replace('Q', ''));
          const qYear = parseInt(qYearStr);

          const quarterMonths = [
            [3, 4, 5],
            [6, 7, 8],
            [9, 10, 11],
            [0, 1, 2],
          ];

          const startMonth = quarterMonths[quarterNumber - 1][0];
          const endMonth = quarterMonths[quarterNumber - 1][2];
          const startYear = quarterNumber === 4 ? qYear + 1 : qYear;
          const endYear = quarterNumber === 4 ? qYear + 1 : qYear;

          start = new Date(startYear, startMonth, 1);
          end = new Date(endYear, endMonth + 1, 0, 23, 59, 59);
        } else {
          const currentDate = new Date();
          const month = currentDate.getMonth();
          const year = currentDate.getFullYear();

          if (month >= 3 && month <= 5) {
            start = new Date(year, 3, 1);
            end = new Date(year, 5, 30, 23, 59, 59);
          } else if (month >= 6 && month <= 8) {
            start = new Date(year, 6, 1);
            end = new Date(year, 8, 30, 23, 59, 59);
          } else if (month >= 9 && month <= 11) {
            start = new Date(year, 9, 1);
            end = new Date(year, 11, 31, 23, 59, 59);
          } else {
            start = new Date(year, 0, 1);
            end = new Date(year, 2, 31, 23, 59, 59);
          }
        }
        break;
      case 'all':
        start = new Date(0);
        end = new Date();
        break;
      default:
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const fiscalYearStart = currentMonth < 3 ? currentYear - 1 : currentYear;
        start = new Date(fiscalYearStart, 3, 1);
        end = new Date(fiscalYearStart + 1, 2, 31, 23, 59, 59);
    }

    return { startDate: start, endDate: end };
  }

  private applyFiltersToQuery(query: any, filters: DashboardFiltersDto): void {
    if (filters.fiscalYear) {
      const fyInfo = this.calculateDateRange('yearly', { year: filters.fiscalYear });
      query.purchased_date = {
        $gte: fyInfo.startDate,
        $lte: fyInfo.endDate,
      };
    }

    if (filters.startDate && filters.endDate) {
      query.purchased_date = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    if (filters.clientIds && filters.clientIds.length > 0) {
      query.client_id = { $in: filters.clientIds };
    }

    if (filters.productIds && filters.productIds.length > 0) {
      query.products = { $in: filters.productIds };
    }
  }

  private async getOrderRevenue(dateRange: any, filters: DashboardFiltersDto): Promise<number> {
    const query: any = {};
    this.applyFiltersToQuery(query, filters);
    if (dateRange.startDate && dateRange.endDate) {
      query.purchased_date = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }

    const result = await this.orderModel.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$base_cost' } } }
    ]).exec();

    return result[0]?.total || 0;
  }

  private async getAMCRevenue(dateRange: any, filters: DashboardFiltersDto): Promise<number> {
    const query: any = {};
    if (dateRange.startDate && dateRange.endDate) {
      query['payments.from_date'] = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }
    query['payments.status'] = PAYMENT_STATUS_ENUM.PAID;

    const result = await this.amcModel.aggregate([
      { $match: query },
      { $unwind: '$payments' },
      { $match: { 'payments.status': PAYMENT_STATUS_ENUM.PAID } },
      { $group: { _id: null, total: { $sum: '$payments.total_cost' } } }
    ]).exec();

    return result[0]?.total || 0;
  }

  private async getCustomizationRevenue(dateRange: any, filters: DashboardFiltersDto): Promise<number> {
    const query: any = {};
    if (dateRange.startDate && dateRange.endDate) {
      query.purchased_date = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }

    const result = await this.customizationModel.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$cost' } } }
    ]).exec();

    return result[0]?.total || 0;
  }

  private async getLicenseRevenue(dateRange: any, filters: DashboardFiltersDto): Promise<number> {
    const query: any = {};
    if (dateRange.startDate && dateRange.endDate) {
      query.purchase_date = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }

    const result = await this.licenseModel.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: { $multiply: ['$rate.amount', '$total_license'] } } } }
    ]).exec();

    return result[0]?.total || 0;
  }

  private async getServiceRevenue(dateRange: any, filters: DashboardFiltersDto): Promise<number> {
    const query: any = {};
    if (dateRange.startDate && dateRange.endDate) {
      query.purchased_date = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }

    const result = await this.additionalServiceModel.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$cost' } } }
    ]).exec();

    return result[0]?.total || 0;
  }

  private async getDashboardTrends(filters: DashboardFiltersDto): Promise<DashboardTrendsDto> {
    const dateRange = this.calculateDateRange(filters.filter, {
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    const totalBilling = await this.getTotalBussinessRevenue(filters.filter, {
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    const expectedVsReceived = await this.getExpectedVsReceivedChartData(filters.filter, {
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    const amcBreakdown = await this.getAMCAnnualBreakdown(filters.filter, {
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    return {
      totalBilling: totalBilling.map(item => ({
        period: item.period,
        newBusiness: item.total_purchase_billing || 0,
        amc: item.total_amc_billing || 0,
      })),
      expectedVsReceived: expectedVsReceived.map(item => ({
        period: item.period,
        expected: item.expected_amount,
        received: item.received_amount,
      })),
      amcBreakdown: amcBreakdown.map(item => ({
        period: item.period,
        expected: item.totalExpected,
        collected: item.totalCollected,
      })),
    };
  }

  private async getDashboardDistributions(filters: DashboardFiltersDto): Promise<DashboardDistributionsDto> {
    const dateRange = this.calculateDateRange(filters.filter, {
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    const productWise = await this.getProductWiseRevenueDistribution(filters.filter, {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    const industryWise = await this.getIndustryWiseRevenueDistribution(filters.filter, {
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    return {
      productWise: productWise.map(item => ({
        productId: item.productId,
        productName: item.productName,
        revenue: item.revenue,
        percentage: item.percentage || 0,
      })),
      industryWise: industryWise.map(item => ({
        industry: item.industry,
        revenue: item.total,
        percentage: 0,
      })),
      clientWise: [],
    };
  }

  private async getTopPerformers(filters: DashboardFiltersDto): Promise<TopPerformersDto> {
    const distributions = await this.getDashboardDistributions(filters);

    return {
      topProducts: distributions.productWise.slice(0, 5).map(item => ({
        productId: item.productId,
        productName: item.productName,
        revenue: item.revenue,
      })),
      topClients: [],
      topIndustries: distributions.industryWise.slice(0, 5).map(item => ({
        industry: item.industry,
        revenue: item.revenue,
      })),
    };
  }

  private async getProductDrillDown(filters: DrillDownFiltersDto, dateRange: any): Promise<any[]> {
    const query: any = {};
    if (filters.drilldownValue) {
      query.products = filters.drilldownValue;
    }

    if (dateRange.startDate && dateRange.endDate) {
      query.purchased_date = { $gte: dateRange.startDate, $lte: dateRange.endDate };
    }

    const aggregation: PipelineStage[] = [
      { $match: query },
      {
        $group: {
          _id: { period: { $dateToString: { format: '%Y-%m', date: '$purchased_date' } } },
          revenue: { $sum: '$base_cost' },
        }
      },
      { $sort: { '_id.period': 1 } },
    ];

    const result = await this.orderModel.aggregate(aggregation).exec();
    return result.map(item => ({
      period: item._id.period,
      revenue: item.revenue,
      orderRevenue: item.revenue,
      amcRevenue: 0,
      customizationRevenue: 0,
      licenseRevenue: 0,
      serviceRevenue: 0,
    }));
  }

  private async getClientDrillDown(filters: DrillDownFiltersDto, dateRange: any): Promise<any[]> {
    return [];
  }

  private async getIndustryDrillDown(filters: DrillDownFiltersDto, dateRange: any): Promise<any[]> {
    return [];
  }

  private async getTimeDrillDown(filters: DrillDownFiltersDto, dateRange: any): Promise<any[]> {
    return [];
  }

  private async getAMCDrillDown(filters: DrillDownFiltersDto, dateRange: any): Promise<any[]> {
    return [];
  }

  private async getTransactionDetails(filters: DrillDownFiltersDto, dateRange: any): Promise<any[]> {
    return [];
  }

  private async getTotalBussinessRevenue(filter: string, options?: any): Promise<any[]> {
    const [start, end] = [this.calculateDateRange(filter, options).startDate, this.calculateDateRange(filter, options).endDate];

    const groupByPeriod = (date: Date) => {
      const dateObj = new Date(date);
      switch (filter) {
        case 'monthly':
          return dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
        case 'yearly':
          const dateYear = dateObj.getFullYear();
          const dateMonth = dateObj.getMonth();
          const fiscalYearStart = dateMonth < 3 ? dateYear - 1 : dateYear;
          return `FY${fiscalYearStart.toString().slice(-2)}-${(fiscalYearStart + 1).toString().slice(-2)}`;
        default:
          return 'All Time';
      }
    };

    const billingMap = new Map<string, { totalPurchaseBilling: number; totalAMCBilling: number }>();

    const addBilling = (date: Date, billing: { purchase?: number; amc?: number }) => {
      if (date < start || date > end) return;
      const period = groupByPeriod(date);
      if (!billingMap.has(period)) {
        billingMap.set(period, { totalPurchaseBilling: 0, totalAMCBilling: 0 });
      }
      const entry = billingMap.get(period)!;
      if (billing.purchase) entry.totalPurchaseBilling += billing.purchase;
      if (billing.amc) entry.totalAMCBilling += billing.amc;
    };

    const orders = await this.orderModel.find({ payment_terms: { $exists: true } }).lean();
    for (const order of orders) {
      for (const term of order.payment_terms || []) {
        addBilling(term.payment_receive_date, { purchase: term.calculated_amount || 0 });
      }
    }

    const customizations = await this.customizationModel.find().lean();
    for (const item of customizations) {
      addBilling(item.purchased_date, { purchase: item.cost || 0 });
    }

    const licenses = await this.licenseModel.find().lean();
    for (const lic of licenses) {
      const licenseBilling = (lic.rate?.amount || 0) * (lic.total_license || 0);
      addBilling(lic.purchase_date, { purchase: licenseBilling });
    }

    const services = await this.additionalServiceModel.find().lean();
    for (const service of services) {
      addBilling(service.purchased_date, { purchase: service.cost || 0 });
    }

    const amcs = await this.amcModel.find().lean();
    for (const amc of amcs) {
      for (const payment of amc.payments || []) {
        addBilling(payment.from_date, { amc: payment.total_cost || amc.amount || 0 });
      }
    }

    return Array.from(billingMap.entries()).map(([period, data]) => ({
      period,
      total_amc_billing: data.totalAMCBilling,
      total_purchase_billing: data.totalPurchaseBilling,
    }));
  }

  private async getExpectedVsReceivedChartData(filter: string, options?: any): Promise<any[]> {
    const [start, end] = [this.calculateDateRange(filter, options).startDate, this.calculateDateRange(filter, options).endDate];

    const billingMap = new Map<string, { expected: number; received: number }>();

    const addBilling = (date: Date, expected: number, received: number) => {
      if (date < start || date > end) return;
      const dateObj = new Date(date);
      const period = dateObj.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!billingMap.has(period)) {
        billingMap.set(period, { expected: 0, received: 0 });
      }
      const entry = billingMap.get(period)!;
      entry.expected += expected;
      entry.received += received;
    };

    const orders = await this.orderModel.find({ payment_terms: { $exists: true } }).lean();
    for (const order of orders) {
      for (const term of order.payment_terms || []) {
        addBilling(term.payment_receive_date, term.calculated_amount || 0, term.calculated_amount || 0);
      }
    }

    return Array.from(billingMap.entries()).map(([period, data]) => ({
      period,
      expected_amount: data.expected,
      received_amount: data.received,
    }));
  }

  private async getAMCAnnualBreakdown(filter: string, options?: any): Promise<any[]> {
    const [start, end] = [this.calculateDateRange(filter, options).startDate, this.calculateDateRange(filter, options).endDate];

    const breakdownMap = new Map<string, { totalExpected: number; totalCollected: number }>();

    const amcs = await this.amcModel.find().lean();
    for (const amc of amcs) {
      for (const payment of amc.payments || []) {
        if (payment.from_date >= start && payment.from_date <= end) {
          const dateObj = new Date(payment.from_date);
          const period = dateObj.toLocaleString('default', { month: 'short', year: '2-digit' });
          if (!breakdownMap.has(period)) {
            breakdownMap.set(period, { totalExpected: 0, totalCollected: 0 });
          }
          const entry = breakdownMap.get(period)!;
          entry.totalExpected += amc.amount || 0;
          if (payment.status === PAYMENT_STATUS_ENUM.PAID) {
            entry.totalCollected += payment.total_cost || amc.amount || 0;
          }
        }
      }
    }

    return Array.from(breakdownMap.entries()).map(([period, data]) => ({
      period,
      totalExpected: data.totalExpected,
      totalCollected: data.totalCollected,
    }));
  }

  private async getProductWiseRevenueDistribution(filter: string, options?: any): Promise<any[]> {
    const [start, end] = [this.calculateDateRange(filter, options).startDate, this.calculateDateRange(filter, options).endDate];

    const dateFilter = filter === 'all' ? {} : { purchased_date: { $gte: start, $lte: end } };

    const orders = await this.orderModel.find(dateFilter).populate('products').lean();
    const productsRevenueMap = new Map<string, { product: any; revenue: number }>();

    for (const order of orders) {
      if (!order.products || order.products.length === 0) continue;

      const productIds = order.products.map((p: any) => p.toString());
      const productRevenues = new Map<string, number>();

      if (order.products.length === 1) {
        const productId = productIds[0];
        productRevenues.set(productId, order.base_cost || 0);
      } else {
        if (order.base_cost_seperation && order.base_cost_seperation.length > 0) {
          order.base_cost_seperation.forEach((sep: any) => {
            const productId = sep.product_id.toString();
            productRevenues.set(productId, sep.amount || 0);
          });
        } else {
          const amountPerProduct = (order.base_cost || 0) / order.products.length;
          productIds.forEach((productId: string) => {
            productRevenues.set(productId, amountPerProduct);
          });
        }
      }

      for (const [productId, revenue] of productRevenues.entries()) {
        const existing = productsRevenueMap.get(productId) || { product: null, revenue: 0 };
        existing.revenue += revenue;
        if (!existing.product) {
          const product = await this.productModel.findById(productId).lean();
          existing.product = product;
        }
        productsRevenueMap.set(productId, existing);
      }
    }

    const productsRevenueArray = Array.from(productsRevenueMap.values()).filter((pr) => pr.product);
    const totalRevenue = productsRevenueArray.reduce((sum, pr) => sum + pr.revenue, 0);

    return productsRevenueArray.map((pr) => ({
      productId: pr.product._id,
      productName: pr.product.name,
      revenue: pr.revenue,
      percentage: totalRevenue > 0 ? (pr.revenue / totalRevenue) * 100 : 0,
    }));
  }

  private async getIndustryWiseRevenueDistribution(filter: string, options?: any): Promise<any[]> {
    const [start, end] = [this.calculateDateRange(filter, options).startDate, this.calculateDateRange(filter, options).endDate];

    const industryMap = new Map<string, number>();

    const orders = await this.orderModel.find({
      purchased_date: { $gte: start, $lte: end }
    }).populate('client_id').lean();

    for (const order of orders) {
      if (order.client_id && (order.client_id as any).industry) {
        const industry = (order.client_id as any).industry;
        industryMap.set(industry, (industryMap.get(industry) || 0) + (order.base_cost || 0));
      }
    }

    const resultArray = Array.from(industryMap.entries()).map(([industry, total]) => ({
      industry,
      total,
    }));

    return resultArray.sort((a, b) => b.total - a.total);
  }
}
