import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { PipelineStage, Types } from 'mongoose';
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
import {
  FilterPreset,
  FilterPresetDocument,
} from '@/db/schema/filter-preset.schema';
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

  /**
   * Converts string IDs to ObjectId for MongoDB queries
   * Handles both string and ObjectId inputs
   */
  private convertToObjectId(id: string | any): Types.ObjectId | null {
    if (!id) return null;
    if (typeof id === 'string') {
      try {
        return new Types.ObjectId(id);
      } catch (e) {
        return null;
      }
    }
    return id instanceof Types.ObjectId ? id : null;
  }

  /**
   * Converts array of string IDs to ObjectId array
   */
  private convertToObjectIdArray(ids: string[]): Types.ObjectId[] {
    return ids
      .map((id) => this.convertToObjectId(id))
      .filter((id): id is Types.ObjectId => id !== null);
  }

  /**
   * Safely converts ObjectId or mixed type to string for comparisons
   */
  private toStringId(id: any): string {
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (id && typeof id.toString === 'function') return id.toString();
    return '';
  }

  /**
   * Formats date to period string based on filter type
   * Supports Indian Fiscal Year (April-March)
   */
  private formatPeriod(date: Date, filter: string): string {
    switch (filter) {
      case 'monthly':
        return date.toLocaleString('default', {
          month: 'short',
          year: '2-digit',
        });
      case 'quarterly':
        const month = date.getMonth();
        const year = date.getFullYear();
        let quarter: number;
        let fiscalYear: number;
        if (month >= 3 && month <= 5) {
          quarter = 1;
          fiscalYear = year;
        } else if (month >= 6 && month <= 8) {
          quarter = 2;
          fiscalYear = year;
        } else if (month >= 9 && month <= 11) {
          quarter = 3;
          fiscalYear = year;
        } else {
          quarter = 4;
          fiscalYear = year + 1;
        }
        return `Q${quarter} FY${fiscalYear.toString().slice(-2)}-${(fiscalYear + 1).toString().slice(-2)}`;
      case 'yearly':
        const fyMonth = date.getMonth();
        const fyYear =
          fyMonth < 3 ? date.getFullYear() - 1 : date.getFullYear();
        return `FY${fyYear.toString().slice(-2)}-${(fyYear + 1).toString().slice(-2)}`;
      default:
        return date.toLocaleString('default', {
          month: 'short',
          year: '2-digit',
        });
    }
  }

  /**
   * Formats date to period string based on aggregation type
   */
  private formatAggregationPeriod(date: Date, aggregation: string): string {
    switch (aggregation) {
      case 'daily':
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `Week ${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
      case 'monthly':
        return date.toLocaleString('default', { month: 'short', year: '2-digit' });
      case 'quarterly':
        const month = date.getMonth();
        const year = date.getFullYear();
        let quarter: number;
        let fiscalYear: number;
        if (month >= 3 && month <= 5) {
          quarter = 1;
          fiscalYear = year;
        } else if (month >= 6 && month <= 8) {
          quarter = 2;
          fiscalYear = year;
        } else if (month >= 9 && month <= 11) {
          quarter = 3;
          fiscalYear = year;
        } else {
          quarter = 4;
          fiscalYear = year + 1;
        }
        return `Q${quarter} FY${fiscalYear.toString().slice(-2)}-${(fiscalYear + 1).toString().slice(-2)}`;
      default:
        return date.toLocaleString('default', { month: 'short', year: '2-digit' });
    }
  }

  /**
   * Converts filter type to aggregation type for period grouping
   */
  private getAggregationFromFilter(filter: string): string {
    switch (filter) {
      case 'monthly':
        return 'monthly';
      case 'quarterly':
        return 'quarterly';
      case 'yearly':
        return 'yearly';
      case 'all':
        return 'yearly';
      default:
        return 'monthly';
    }
  }

  async getDashboardData(
    filters: DashboardFiltersDto,
  ): Promise<DashboardResponseDto> {
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

    const totalRevenue =
      orderRevenue +
      amcRevenue +
      customizationRevenue +
      licenseRevenue +
      serviceRevenue;

    const [
      pendingPayments,
      paidPayments,
      totalClients,
      totalOrders,
      revenueGrowth,
    ] = await Promise.all([
      this.calculatePendingPayments(dateRange, filters),
      this.calculatePaidPayments(dateRange, filters),
      this.calculateTotalClients(dateRange, filters),
      this.calculateTotalOrders(dateRange, filters),
      this.calculateRevenueGrowth(dateRange, filters),
    ]);

    const summary: DashboardSummaryDto = {
      totalRevenue,
      amcRevenue,
      newBusinessRevenue: orderRevenue,
      customizationRevenue,
      licenseRevenue,
      additionalServiceRevenue: serviceRevenue,
      pendingPayments,
      paidPayments,
      totalClients,
      totalOrders,
      revenueGrowth,
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

  async getDrillDownData(
    filters: DrillDownFiltersDto,
  ): Promise<DrillDownResponseDto> {
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
      pagination: filters.includeDetails
        ? {
            page: filters.page || 1,
            limit: filters.limit || 20,
            total: metadata.totalRecords,
            totalPages: Math.ceil(
              metadata.totalRecords / (filters.limit || 20),
            ),
          }
        : undefined,
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
      this.clientModel
        .find()
        .select('_id name')
        .lean()
        .then((docs) =>
          docs.map((c: any) => ({ value: c._id.toString(), label: c.name })),
        ),
      this.productModel
        .find()
        .select('_id name')
        .lean()
        .then((docs) =>
          docs.map((p: any) => ({ value: p._id.toString(), label: p.name })),
        ),
      this.clientModel
        .distinct('industry')
        .lean()
        .then((items) =>
          items.filter(Boolean).map((i: any) => ({ value: i, label: i })),
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
    options?: {
      year?: number;
      quarter?: string;
      startDate?: string;
      endDate?: string;
    },
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
      case 'custom':
        if (options?.startDate && options?.endDate) {
          start = new Date(options.startDate);
          end = new Date(options.endDate);
          end.setHours(23, 59, 59, 999);
        } else {
          // Fallback to current fiscal year
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth();
          const fiscalYearStart =
            currentMonth < 3 ? currentYear - 1 : currentYear;
          start = new Date(fiscalYearStart, 3, 1);
          end = new Date(fiscalYearStart + 1, 2, 31, 23, 59, 59);
        }
        break;
      default:
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const fiscalYearStart =
          currentMonth < 3 ? currentYear - 1 : currentYear;
        start = new Date(fiscalYearStart, 3, 1);
        end = new Date(fiscalYearStart + 1, 2, 31, 23, 59, 59);
    }

    return { startDate: start, endDate: end };
  }

  private applyFiltersToQuery(query: any, filters: DashboardFiltersDto): void {
    if (filters.fiscalYear) {
      const fyInfo = this.calculateDateRange('yearly', {
        year: filters.fiscalYear,
      });
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

  /**
   * Calculates paid payments across all revenue streams
   */
  private async calculatePaidPayments(
    dateRange: any,
    filters: DashboardFiltersDto,
  ): Promise<number> {
    const paidStatuses = [PAYMENT_STATUS_ENUM.PAID];
    const [start, end] = [dateRange.startDate, dateRange.endDate];

    // Orders - paid payment terms
    const orderPaid = await this.orderModel
      .aggregate([
        {
          $match: {
            'payment_terms.payment_receive_date': { $gte: start, $lte: end },
          },
        },
        { $unwind: '$payment_terms' },
        {
          $match: {
            'payment_terms.status': { $in: paidStatuses },
            'payment_terms.payment_receive_date': { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$payment_terms.calculated_amount' },
          },
        },
      ])
      .exec();

    // AMC - paid payments
    const amcPaid = await this.amcModel
      .aggregate([
        { $match: { 'payments.received_date': { $gte: start, $lte: end } } },
        { $unwind: '$payments' },
        {
          $match: {
            'payments.status': { $in: paidStatuses },
            'payments.received_date': { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $ifNull: ['$payments.amc_rate_amount', '$payments.total_cost'],
              },
            },
          },
        },
      ])
      .exec();

    // Customizations - paid
    const customizationPaid = await this.customizationModel
      .aggregate([
        {
          $match: {
            payment_status: { $in: paidStatuses },
            payment_receive_date: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$cost' },
          },
        },
      ])
      .exec();

    // Licenses - paid
    const licensePaid = await this.licenseModel
      .aggregate([
        {
          $match: {
            payment_status: { $in: paidStatuses },
            payment_receive_date: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ['$rate.amount', '$total_license'] } },
          },
        },
      ])
      .exec();

    // Services - paid
    const servicePaid = await this.additionalServiceModel
      .aggregate([
        {
          $match: {
            payment_status: { $in: paidStatuses },
            payment_receive_date: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$cost' },
          },
        },
      ])
      .exec();

    return (
      (orderPaid[0]?.total || 0) +
      (amcPaid[0]?.total || 0) +
      (customizationPaid[0]?.total || 0) +
      (licensePaid[0]?.total || 0) +
      (servicePaid[0]?.total || 0)
    );
  }

  /**
   * Calculates pending payments (PENDING + PROFORMA + INVOICE)
   */
  private async calculatePendingPayments(
    dateRange: any,
    filters: DashboardFiltersDto,
  ): Promise<number> {
    const pendingStatuses = [
      PAYMENT_STATUS_ENUM.PENDING,
      PAYMENT_STATUS_ENUM.proforma,
      PAYMENT_STATUS_ENUM.INVOICE,
    ];
    const [start, end] = [dateRange.startDate, dateRange.endDate];

    // Orders - pending payment terms
    const orderPending = await this.orderModel
      .aggregate([
        {
          $match: {
            'payment_terms.payment_receive_date': { $gte: start, $lte: end },
          },
        },
        { $unwind: '$payment_terms' },
        {
          $match: {
            'payment_terms.status': { $in: pendingStatuses },
            'payment_terms.payment_receive_date': { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$payment_terms.calculated_amount' },
          },
        },
      ])
      .exec();

    // AMC - pending payments
    const amcPending = await this.amcModel
      .aggregate([
        { $match: { 'payments.from_date': { $gte: start, $lte: end } } },
        { $unwind: '$payments' },
        {
          $match: {
            'payments.status': { $in: pendingStatuses },
            'payments.from_date': { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $ifNull: ['$payments.total_cost', '$payments.amc_rate_amount'],
              },
            },
          },
        },
      ])
      .exec();

    // Customizations - pending
    const customizationPending = await this.customizationModel
      .aggregate([
        {
          $match: {
            payment_status: { $in: pendingStatuses },
            payment_receive_date: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$cost' },
          },
        },
      ])
      .exec();

    // Licenses - pending
    const licensePending = await this.licenseModel
      .aggregate([
        {
          $match: {
            payment_status: { $in: pendingStatuses },
            payment_receive_date: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ['$rate.amount', '$total_license'] } },
          },
        },
      ])
      .exec();

    // Services - pending
    const servicePending = await this.additionalServiceModel
      .aggregate([
        {
          $match: {
            payment_status: { $in: pendingStatuses },
            payment_receive_date: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$cost' },
          },
        },
      ])
      .exec();

    return (
      (orderPending[0]?.total || 0) +
      (amcPending[0]?.total || 0) +
      (customizationPending[0]?.total || 0) +
      (licensePending[0]?.total || 0) +
      (servicePending[0]?.total || 0)
    );
  }

  /**
   * Calculates total unique clients across all revenue streams
   */
  private async calculateTotalClients(
    dateRange: any,
    filters: DashboardFiltersDto,
  ): Promise<number> {
    const [start, end] = [dateRange.startDate, dateRange.endDate];

    // Collect all client IDs from all revenue streams in date range
    const [
      orderClients,
      amcClients,
      customClientIds,
      licenseClientIds,
      serviceClientIds,
    ] = await Promise.all([
      this.orderModel.distinct('client_id', {
        'payment_terms.payment_receive_date': { $gte: start, $lte: end },
      }),
      this.amcModel.distinct('client_id', {
        'payments.received_date': { $gte: start, $lte: end },
      }),
      this.customizationModel
        .find({
          payment_receive_date: { $gte: start, $lte: end },
        })
        .populate('order_id')
        .lean()
        .then((docs) =>
          docs.map((d: any) => this.toStringId((d.order_id as any)?.client_id)),
        ),
      this.licenseModel
        .find({
          payment_receive_date: { $gte: start, $lte: end },
        })
        .populate('order_id')
        .lean()
        .then((docs) =>
          docs.map((d: any) => this.toStringId((d.order_id as any)?.client_id)),
        ),
      this.additionalServiceModel
        .find({
          payment_receive_date: { $gte: start, $lte: end },
        })
        .populate('order_id')
        .lean()
        .then((docs) =>
          docs.map((d: any) => this.toStringId((d.order_id as any)?.client_id)),
        ),
    ]);

    // Combine all client IDs and deduplicate using Set
    const allClientIds = new Set<string>(
      [
        ...orderClients.map((id: any) => this.toStringId(id)),
        ...amcClients.map((id: any) => this.toStringId(id)),
        ...customClientIds,
        ...licenseClientIds,
        ...serviceClientIds,
      ].filter((id) => id !== ''),
    );

    return allClientIds.size;
  }

  /**
   * Calculates revenue growth compared to previous period
   */
  private async calculateRevenueGrowth(
    dateRange: any,
    filters: DashboardFiltersDto,
  ): Promise<number> {
    const [currentStart, currentEnd] = [dateRange.startDate, dateRange.endDate];
    const periodDuration = currentEnd.getTime() - currentStart.getTime();
    
    // Calculate previous period with same duration
    const previousStart = new Date(currentStart.getTime() - periodDuration);
    const previousEnd = new Date(currentEnd.getTime() - periodDuration);
    
    const previousDateRange = { startDate: previousStart, endDate: previousEnd };
    
    // Get current period revenue
    const currentRevenue = await this.getTotalRevenueForRange(currentStart, currentEnd, filters);
    
    // Get previous period revenue
    const previousRevenue = await this.getTotalRevenueForRange(previousStart, previousEnd, filters);
    
    if (previousRevenue === 0) {
      return currentRevenue > 0 ? 100 : 0;
    }
    
    return parseFloat(((currentRevenue - previousRevenue) / previousRevenue * 100).toFixed(2));
  }
  
  /**
   * Gets total revenue across all streams for a date range
   */
  private async getTotalRevenueForRange(
    startDate: Date,
    endDate: Date,
    filters: DashboardFiltersDto,
  ): Promise<number> {
    const dateRange = { startDate, endDate };
    const [orderRevenue, amcRevenue, customizationRevenue, licenseRevenue, serviceRevenue] = await Promise.all([
      this.getOrderRevenue(dateRange, filters),
      this.getAMCRevenue(dateRange, filters),
      this.getCustomizationRevenue(dateRange, filters),
      this.getLicenseRevenue(dateRange, filters),
      this.getServiceRevenue(dateRange, filters),
    ]);
    
    return orderRevenue + amcRevenue + customizationRevenue + licenseRevenue + serviceRevenue;
  }

  /**
   * Calculates total orders in date range
   */
  private async calculateTotalOrders(
    dateRange: any,
    filters: DashboardFiltersDto,
  ): Promise<number> {
    const [start, end] = [dateRange.startDate, dateRange.endDate];

    const query: any = {};
    if (dateRange.startDate && dateRange.endDate) {
      query.purchased_date = { $gte: start, $lte: end };
    }

    // Apply client filter if provided
    if (filters.clientIds && filters.clientIds.length > 0) {
      query.client_id = { $in: this.convertToObjectIdArray(filters.clientIds) };
    }

    return this.orderModel.countDocuments(query).exec();
  }

  private async getOrderRevenue(
    dateRange: any,
    filters: DashboardFiltersDto,
  ): Promise<number> {
    const [start, end] = [dateRange.startDate, dateRange.endDate];
    const paidStatuses =
      filters.paymentStatuses && filters.paymentStatuses.length > 0
        ? filters.paymentStatuses
        : [PAYMENT_STATUS_ENUM.PAID];

    const result = await this.orderModel
      .aggregate([
        {
          $match: {
            'payment_terms.payment_receive_date': { $gte: start, $lte: end },
          },
        },
        { $unwind: '$payment_terms' },
        {
          $match: {
            'payment_terms.status': { $in: paidStatuses },
            'payment_terms.payment_receive_date': { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$payment_terms.calculated_amount' },
          },
        },
      ])
      .exec();

    return result[0]?.total || 0;
  }

  private async getAMCRevenue(
    dateRange: any,
    filters: DashboardFiltersDto,
  ): Promise<number> {
    const [start, end] = [dateRange.startDate, dateRange.endDate];
    const paidStatuses =
      filters.paymentStatuses && filters.paymentStatuses.length > 0
        ? filters.paymentStatuses
        : [PAYMENT_STATUS_ENUM.PAID];

    const result = await this.amcModel
      .aggregate([
        { $match: { 'payments.received_date': { $gte: start, $lte: end } } },
        { $unwind: '$payments' },
        {
          $match: {
            'payments.status': { $in: paidStatuses },
            'payments.received_date': { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $ifNull: ['$payments.amc_rate_amount', '$payments.total_cost'],
              },
            },
          },
        },
      ])
      .exec();

    return result[0]?.total || 0;
  }

  private async getCustomizationRevenue(
    dateRange: any,
    filters: DashboardFiltersDto,
  ): Promise<number> {
    const [start, end] = [dateRange.startDate, dateRange.endDate];
    const paidStatuses =
      filters.paymentStatuses && filters.paymentStatuses.length > 0
        ? filters.paymentStatuses
        : [PAYMENT_STATUS_ENUM.PAID];

    const query: any = {};
    if (dateRange.startDate && dateRange.endDate) {
      query.payment_receive_date = { $gte: start, $lte: end };
      query.payment_status = { $in: paidStatuses };
    }

    const result = await this.customizationModel
      .aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: '$cost' } } },
      ])
      .exec();

    return result[0]?.total || 0;
  }

  private async getLicenseRevenue(
    dateRange: any,
    filters: DashboardFiltersDto,
  ): Promise<number> {
    const query: any = {};
    if (dateRange.startDate && dateRange.endDate) {
      query.purchase_date = {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      };
    }

    const result = await this.licenseModel
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ['$rate.amount', '$total_license'] } },
          },
        },
      ])
      .exec();

    return result[0]?.total || 0;
  }

  private async getServiceRevenue(
    dateRange: any,
    filters: DashboardFiltersDto,
  ): Promise<number> {
    const query: any = {};
    if (dateRange.startDate && dateRange.endDate) {
      query.purchased_date = {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      };
    }

    const result = await this.additionalServiceModel
      .aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: '$cost' } } },
      ])
      .exec();

    return result[0]?.total || 0;
  }

  private async getDashboardTrends(
    filters: DashboardFiltersDto,
  ): Promise<DashboardTrendsDto> {
    const dateRange = this.calculateDateRange(filters.filter, {
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    const totalBilling = await this.getTotalBussinessRevenue(filters.filter, {
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    const expectedVsReceived = await this.getExpectedVsReceivedChartData(
      filters.filter,
      {
        year: filters.fiscalYear,
        quarter: filters.quarter,
      },
    );

    const amcBreakdown = await this.getAMCAnnualBreakdown(filters.filter, {
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    return {
      totalBilling: totalBilling.map((item) => ({
        period: item.period,
        newBusiness: item.total_purchase_billing || 0,
        amc: item.total_amc_billing || 0,
      })),
      expectedVsReceived: expectedVsReceived.map((item) => ({
        period: item.period,
        expected: item.expected_amount,
        received: item.received_amount,
      })),
      amcBreakdown: amcBreakdown.map((item) => ({
        period: item.period,
        expected: item.totalExpected,
        collected: item.totalCollected,
      })),
    };
  }

  private async getDashboardDistributions(
    filters: DashboardFiltersDto,
  ): Promise<DashboardDistributionsDto> {
    const dateRange = this.calculateDateRange(filters.filter, {
      year: filters.fiscalYear,
      quarter: filters.quarter,
    });

    const productWise = await this.getProductWiseRevenueDistribution(
      filters.filter,
      {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        year: filters.fiscalYear,
        quarter: filters.quarter,
      },
    );

    const industryWise = await this.getIndustryWiseRevenueDistribution(
      filters.filter,
      {
        year: filters.fiscalYear,
        quarter: filters.quarter,
      },
    );

    const clientWise = await this.getClientWiseRevenueDistribution(
      filters.filter,
      {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        year: filters.fiscalYear,
        quarter: filters.quarter,
      },
    );

    return {
      productWise: productWise.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        revenue: item.revenue,
        percentage: item.percentage || 0,
      })),
      industryWise: industryWise.map((item) => ({
        industry: item.industry,
        revenue: item.total,
        percentage: 0,
      })),
      clientWise,
    };
  }

  private async getTopPerformers(
    filters: DashboardFiltersDto,
  ): Promise<TopPerformersDto> {
    const distributions = await this.getDashboardDistributions(filters);

    return {
      topProducts: distributions.productWise.slice(0, 5).map((item) => ({
        productId: item.productId,
        productName: item.productName,
        revenue: item.revenue,
      })),
      topClients: distributions.clientWise.slice(0, 5).map((item) => ({
        clientId: item.clientId,
        clientName: item.clientName,
        revenue: item.revenue,
      })),
      topIndustries: distributions.industryWise.slice(0, 5).map((item) => ({
        industry: item.industry,
        revenue: item.revenue,
      })),
    };
  }

  private async getProductDrillDown(
    filters: DrillDownFiltersDto,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<any[]> {
    const aggregation = filters.aggregation || this.getAggregationFromFilter(filters.filter);
    const paidStatuses = filters.paymentStatuses?.length > 0
      ? filters.paymentStatuses
      : [PAYMENT_STATUS_ENUM.PAID];
    const targetProductId = filters.drilldownValue;

    const [start, end] = [dateRange.startDate, dateRange.endDate];
    const revenueMap = new Map<string, any>();

    const addRevenue = (period: string, stream: string, amount: number) => {
      if (!revenueMap.has(period)) {
        revenueMap.set(period, {
          period,
          orderRevenue: 0,
          amcRevenue: 0,
          customizationRevenue: 0,
          licenseRevenue: 0,
          serviceRevenue: 0,
        });
      }
      const entry = revenueMap.get(period);
      entry[stream] = (entry[stream] || 0) + amount;
    };

    // 1. Order Revenue - handle product breakdown
    const orderQuery: any = {
      'payment_terms.payment_receive_date': { $gte: start, $lte: end },
    };
    if (filters.clientIds?.length > 0) {
      orderQuery.client_id = { $in: this.convertToObjectIdArray(filters.clientIds) };
    }

    const orders = await this.orderModel.find(orderQuery).lean();
    for (const order of orders) {
      // Filter by product if specified
      if (targetProductId) {
        const productIds = order.products?.map((p: any) => p.toString()) || [];
        if (!productIds.includes(targetProductId)) continue;
      }

      for (const term of order.payment_terms || []) {
        if (term.payment_receive_date >= start && 
            term.payment_receive_date <= end && 
            paidStatuses.includes(term.status)) {
          const period = this.formatAggregationPeriod(term.payment_receive_date, aggregation);
          
          // Calculate product-specific amount
          let amount = term.calculated_amount || 0;
          if (targetProductId && order.products?.length > 1 && order.base_cost_seperation?.length > 0) {
            // Use cost separation for accurate per-product amount
            const sep = order.base_cost_seperation.find(
              (s: any) => s.product_id.toString() === targetProductId
            );
            if (sep) {
              amount = sep.amount;
            } else {
              amount = amount / order.products.length;
            }
          }
          
          addRevenue(period, 'orderRevenue', amount);
        }
      }
    }

    // 2. AMC Revenue
    const amcQuery: any = {};
    if (filters.clientIds?.length > 0) {
      amcQuery.client_id = { $in: this.convertToObjectIdArray(filters.clientIds) };
    }
    if (targetProductId) {
      amcQuery.products = { $in: [new Types.ObjectId(targetProductId)] };
    }

    const amcs = await this.amcModel.find(amcQuery).lean();
    for (const amc of amcs) {
      for (const payment of amc.payments || []) {
        const paymentDate = payment.status === PAYMENT_STATUS_ENUM.PAID 
          ? payment.received_date 
          : payment.from_date;
        if (paymentDate >= start && paymentDate <= end && paidStatuses.includes(payment.status)) {
          const period = this.formatAggregationPeriod(paymentDate, aggregation);
          const amount = payment.amc_rate_amount || payment.total_cost || amc.amount || 0;
          addRevenue(period, 'amcRevenue', amount);
        }
      }
    }

    // 3. Customization Revenue
    const customizationQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };
    if (targetProductId) {
      customizationQuery.product_id = new Types.ObjectId(targetProductId);
    }
    
    const customizations = await this.customizationModel
      .find(customizationQuery)
      .populate({ path: 'order_id', select: 'client_id' })
      .lean();
      
    for (const cust of customizations) {
      if (filters.clientIds?.length > 0) {
        const orderClientId = this.toStringId((cust.order_id as any)?.client_id);
        if (!filters.clientIds.includes(orderClientId)) continue;
      }
      const period = this.formatAggregationPeriod(cust.payment_receive_date, aggregation);
      addRevenue(period, 'customizationRevenue', cust.cost || 0);
    }

    // 4. License Revenue
    const licenseQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };
    if (targetProductId) {
      licenseQuery.product_id = new Types.ObjectId(targetProductId);
    }
    
    const licenses = await this.licenseModel
      .find(licenseQuery)
      .populate({ path: 'order_id', select: 'client_id' })
      .lean();
      
    for (const license of licenses) {
      if (filters.clientIds?.length > 0) {
        const orderClientId = this.toStringId((license.order_id as any)?.client_id);
        if (!filters.clientIds.includes(orderClientId)) continue;
      }
      const period = this.formatAggregationPeriod(license.payment_receive_date, aggregation);
      const amount = (license.rate?.amount || 0) * (license.total_license || 0);
      addRevenue(period, 'licenseRevenue', amount);
    }

    // 5. Additional Service Revenue
    const serviceQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };
    if (targetProductId) {
      serviceQuery.product_id = new Types.ObjectId(targetProductId);
    }
    
    const services = await this.additionalServiceModel
      .find(serviceQuery)
      .populate({ path: 'order_id', select: 'client_id' })
      .lean();
      
    for (const service of services) {
      if (filters.clientIds?.length > 0) {
        const orderClientId = this.toStringId((service.order_id as any)?.client_id);
        if (!filters.clientIds.includes(orderClientId)) continue;
      }
      const period = this.formatAggregationPeriod(service.payment_receive_date, aggregation);
      addRevenue(period, 'serviceRevenue', service.cost || 0);
    }

    // Convert to array and calculate totals
    const result = Array.from(revenueMap.values()).map((item) => ({
      ...item,
      revenue: item.orderRevenue + item.amcRevenue + item.customizationRevenue + 
               item.licenseRevenue + item.serviceRevenue,
    }));

    return result.sort((a, b) => a.period.localeCompare(b.period));
  }

  private async getClientDrillDown(
    filters: DrillDownFiltersDto,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<any[]> {
    const aggregation = filters.aggregation || this.getAggregationFromFilter(filters.filter);
    const paidStatuses = filters.paymentStatuses?.length > 0
      ? filters.paymentStatuses
      : [PAYMENT_STATUS_ENUM.PAID];
    const targetClientIds = filters.drilldownValue
      ? [filters.drilldownValue]
      : filters.clientIds;

    const [start, end] = [dateRange.startDate, dateRange.endDate];
    const revenueMap = new Map<string, any>();

    const addRevenue = (period: string, stream: string, amount: number) => {
      if (!revenueMap.has(period)) {
        revenueMap.set(period, {
          period,
          orderRevenue: 0,
          amcRevenue: 0,
          customizationRevenue: 0,
          licenseRevenue: 0,
          serviceRevenue: 0,
        });
      }
      const entry = revenueMap.get(period);
      entry[stream] = (entry[stream] || 0) + amount;
    };

    // 1. Order Revenue - filtered by client
    const orderQuery: any = {
      'payment_terms.payment_receive_date': { $gte: start, $lte: end },
    };
    if (targetClientIds?.length > 0) {
      orderQuery.client_id = { $in: this.convertToObjectIdArray(targetClientIds) };
    }
    if (filters.productIds?.length > 0) {
      orderQuery.products = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const orders = await this.orderModel.find(orderQuery).lean();
    for (const order of orders) {
      for (const term of order.payment_terms || []) {
        if (term.payment_receive_date >= start &&
            term.payment_receive_date <= end &&
            paidStatuses.includes(term.status)) {
          const period = this.formatAggregationPeriod(term.payment_receive_date, aggregation);
          addRevenue(period, 'orderRevenue', term.calculated_amount || 0);
        }
      }
    }

    // 2. AMC Revenue
    const amcQuery: any = {};
    if (targetClientIds?.length > 0) {
      amcQuery.client_id = { $in: this.convertToObjectIdArray(targetClientIds) };
    }
    if (filters.productIds?.length > 0) {
      amcQuery.products = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const amcs = await this.amcModel.find(amcQuery).lean();
    for (const amc of amcs) {
      for (const payment of amc.payments || []) {
        const paymentDate = payment.status === PAYMENT_STATUS_ENUM.PAID
          ? payment.received_date
          : payment.from_date;
        if (paymentDate >= start && paymentDate <= end && paidStatuses.includes(payment.status)) {
          const period = this.formatAggregationPeriod(paymentDate, aggregation);
          const amount = payment.amc_rate_amount || payment.total_cost || amc.amount || 0;
          addRevenue(period, 'amcRevenue', amount);
        }
      }
    }

    // 3. Customization Revenue
    const customizationQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };

    const customizations = await this.customizationModel
      .find(customizationQuery)
      .populate({ path: 'order_id', select: 'client_id' })
      .lean();

    for (const cust of customizations) {
      const orderClientId = this.toStringId((cust.order_id as any)?.client_id);
      if (targetClientIds?.length > 0 && !targetClientIds.includes(orderClientId)) continue;
      if (filters.productIds?.length > 0) {
        const prodId = this.toStringId(cust.product_id);
        if (!filters.productIds.includes(prodId)) continue;
      }
      const period = this.formatAggregationPeriod(cust.payment_receive_date, aggregation);
      addRevenue(period, 'customizationRevenue', cust.cost || 0);
    }

    // 4. License Revenue
    const licenseQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };

    const licenses = await this.licenseModel
      .find(licenseQuery)
      .populate({ path: 'order_id', select: 'client_id' })
      .lean();

    for (const license of licenses) {
      const orderClientId = this.toStringId((license.order_id as any)?.client_id);
      if (targetClientIds?.length > 0 && !targetClientIds.includes(orderClientId)) continue;
      if (filters.productIds?.length > 0) {
        const prodId = this.toStringId(license.product_id);
        if (!filters.productIds.includes(prodId)) continue;
      }
      const period = this.formatAggregationPeriod(license.payment_receive_date, aggregation);
      const amount = (license.rate?.amount || 0) * (license.total_license || 0);
      addRevenue(period, 'licenseRevenue', amount);
    }

    // 5. Additional Service Revenue
    const serviceQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };

    const services = await this.additionalServiceModel
      .find(serviceQuery)
      .populate({ path: 'order_id', select: 'client_id' })
      .lean();

    for (const service of services) {
      const orderClientId = this.toStringId((service.order_id as any)?.client_id);
      if (targetClientIds?.length > 0 && !targetClientIds.includes(orderClientId)) continue;
      if (filters.productIds?.length > 0) {
        const prodId = this.toStringId(service.product_id);
        if (!filters.productIds.includes(prodId)) continue;
      }
      const period = this.formatAggregationPeriod(service.payment_receive_date, aggregation);
      addRevenue(period, 'serviceRevenue', service.cost || 0);
    }

    // Convert to array and calculate totals
    const result = Array.from(revenueMap.values()).map((item) => ({
      ...item,
      revenue: item.orderRevenue + item.amcRevenue + item.customizationRevenue +
               item.licenseRevenue + item.serviceRevenue,
    }));

    return result.sort((a, b) => a.period.localeCompare(b.period));
  }

  private async getIndustryDrillDown(
    filters: DrillDownFiltersDto,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<any[]> {
    const aggregation = filters.aggregation || this.getAggregationFromFilter(filters.filter);
    const paidStatuses = filters.paymentStatuses?.length > 0
      ? filters.paymentStatuses
      : [PAYMENT_STATUS_ENUM.PAID];
    const targetIndustry = filters.drilldownValue;

    const [start, end] = [dateRange.startDate, dateRange.endDate];
    const revenueMap = new Map<string, any>();

    const addRevenue = (period: string, stream: string, amount: number) => {
      if (!revenueMap.has(period)) {
        revenueMap.set(period, {
          period,
          orderRevenue: 0,
          amcRevenue: 0,
          customizationRevenue: 0,
          licenseRevenue: 0,
          serviceRevenue: 0,
        });
      }
      const entry = revenueMap.get(period);
      entry[stream] = (entry[stream] || 0) + amount;
    };

    // Get clients in target industry for filtering
    let industryClientIds: string[] = [];
    if (targetIndustry || filters.industries?.length > 0) {
      const industriesToFilter = targetIndustry 
        ? [targetIndustry] 
        : filters.industries;
      const clients = await this.clientModel
        .find({ industry: { $in: industriesToFilter } })
        .select('_id')
        .lean();
      industryClientIds = clients.map((c: any) => c._id.toString());
    }

    // 1. Order Revenue
    const orderQuery: any = {
      'payment_terms.payment_receive_date': { $gte: start, $lte: end },
    };
    if (industryClientIds.length > 0) {
      orderQuery.client_id = { $in: this.convertToObjectIdArray(industryClientIds) };
    }
    if (filters.productIds?.length > 0) {
      orderQuery.products = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const orders = await this.orderModel
      .find(orderQuery)
      .populate({ path: 'client_id', select: 'industry' })
      .lean();
      
    for (const order of orders) {
      const orderIndustry = (order.client_id as any)?.industry;
      if (targetIndustry && orderIndustry !== targetIndustry) continue;
      
      for (const term of order.payment_terms || []) {
        if (term.payment_receive_date >= start && 
            term.payment_receive_date <= end && 
            paidStatuses.includes(term.status)) {
          const period = this.formatAggregationPeriod(term.payment_receive_date, aggregation);
          addRevenue(period, 'orderRevenue', term.calculated_amount || 0);
        }
      }
    }

    // 2. AMC Revenue
    const amcQuery: any = {};
    if (industryClientIds.length > 0) {
      amcQuery.client_id = { $in: this.convertToObjectIdArray(industryClientIds) };
    }
    if (filters.productIds?.length > 0) {
      amcQuery.products = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const amcs = await this.amcModel
      .find(amcQuery)
      .populate({ path: 'client_id', select: 'industry' })
      .lean();
      
    for (const amc of amcs) {
      const amcIndustry = (amc.client_id as any)?.industry;
      if (targetIndustry && amcIndustry !== targetIndustry) continue;
      
      for (const payment of amc.payments || []) {
        const paymentDate = payment.status === PAYMENT_STATUS_ENUM.PAID 
          ? payment.received_date 
          : payment.from_date;
        if (paymentDate >= start && paymentDate <= end && paidStatuses.includes(payment.status)) {
          const period = this.formatAggregationPeriod(paymentDate, aggregation);
          const amount = payment.amc_rate_amount || payment.total_cost || amc.amount || 0;
          addRevenue(period, 'amcRevenue', amount);
        }
      }
    }

    // 3. Customization Revenue
    const customizationQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };
    
    const customizations = await this.customizationModel
      .find(customizationQuery)
      .populate({ 
        path: 'order_id', 
        select: 'client_id',
        populate: { path: 'client_id', select: 'industry' }
      })
      .lean();
      
    for (const cust of customizations) {
      const order = cust.order_id as any;
      const orderIndustry = order?.client_id?.industry;
      if (targetIndustry && orderIndustry !== targetIndustry) continue;
      if (industryClientIds.length > 0) {
        const orderClientId = this.toStringId(order?.client_id?._id);
        if (!industryClientIds.includes(orderClientId)) continue;
      }
      if (filters.productIds?.length > 0) {
        const prodId = this.toStringId(cust.product_id);
        if (!filters.productIds.includes(prodId)) continue;
      }
      const period = this.formatAggregationPeriod(cust.payment_receive_date, aggregation);
      addRevenue(period, 'customizationRevenue', cust.cost || 0);
    }

    // 4. License Revenue
    const licenseQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };
    
    const licenses = await this.licenseModel
      .find(licenseQuery)
      .populate({ 
        path: 'order_id', 
        select: 'client_id',
        populate: { path: 'client_id', select: 'industry' }
      })
      .lean();
      
    for (const license of licenses) {
      const order = license.order_id as any;
      const orderIndustry = order?.client_id?.industry;
      if (targetIndustry && orderIndustry !== targetIndustry) continue;
      if (industryClientIds.length > 0) {
        const orderClientId = this.toStringId(order?.client_id?._id);
        if (!industryClientIds.includes(orderClientId)) continue;
      }
      if (filters.productIds?.length > 0) {
        const prodId = this.toStringId(license.product_id);
        if (!filters.productIds.includes(prodId)) continue;
      }
      const period = this.formatAggregationPeriod(license.payment_receive_date, aggregation);
      const amount = (license.rate?.amount || 0) * (license.total_license || 0);
      addRevenue(period, 'licenseRevenue', amount);
    }

    // 5. Additional Service Revenue
    const serviceQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };
    
    const services = await this.additionalServiceModel
      .find(serviceQuery)
      .populate({ 
        path: 'order_id', 
        select: 'client_id',
        populate: { path: 'client_id', select: 'industry' }
      })
      .lean();
      
    for (const service of services) {
      const order = service.order_id as any;
      const orderIndustry = order?.client_id?.industry;
      if (targetIndustry && orderIndustry !== targetIndustry) continue;
      if (industryClientIds.length > 0) {
        const orderClientId = this.toStringId(order?.client_id?._id);
        if (!industryClientIds.includes(orderClientId)) continue;
      }
      if (filters.productIds?.length > 0) {
        const prodId = this.toStringId(service.product_id);
        if (!filters.productIds.includes(prodId)) continue;
      }
      const period = this.formatAggregationPeriod(service.payment_receive_date, aggregation);
      addRevenue(period, 'serviceRevenue', service.cost || 0);
    }

    // Convert to array and calculate totals
    const result = Array.from(revenueMap.values()).map((item) => ({
      ...item,
      revenue: item.orderRevenue + item.amcRevenue + item.customizationRevenue + 
               item.licenseRevenue + item.serviceRevenue,
    }));

    return result.sort((a, b) => a.period.localeCompare(b.period));
  }

  private async getTimeDrillDown(
    filters: DrillDownFiltersDto,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<any[]> {
    const aggregation = filters.aggregation || this.getAggregationFromFilter(filters.filter);
    const paidStatuses = filters.paymentStatuses?.length > 0
      ? filters.paymentStatuses
      : [PAYMENT_STATUS_ENUM.PAID];

    // Revenue map: period -> { orderRevenue, amcRevenue, customizationRevenue, licenseRevenue, serviceRevenue }
    const revenueMap = new Map<string, any>();

    const addRevenue = (period: string, stream: string, amount: number) => {
      if (!revenueMap.has(period)) {
        revenueMap.set(period, {
          period,
          orderRevenue: 0,
          amcRevenue: 0,
          customizationRevenue: 0,
          licenseRevenue: 0,
          serviceRevenue: 0,
        });
      }
      const entry = revenueMap.get(period);
      entry[stream] = (entry[stream] || 0) + amount;
    };

    const [start, end] = [dateRange.startDate, dateRange.endDate];

    // 1. Order Revenue
    const orderQuery: any = {
      'payment_terms.payment_receive_date': { $gte: start, $lte: end },
    };
    if (filters.clientIds?.length > 0) {
      orderQuery.client_id = { $in: this.convertToObjectIdArray(filters.clientIds) };
    }
    if (filters.productIds?.length > 0) {
      orderQuery.products = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const orders = await this.orderModel.find(orderQuery).lean();
    for (const order of orders) {
      for (const term of order.payment_terms || []) {
        if (term.payment_receive_date >= start && 
            term.payment_receive_date <= end && 
            paidStatuses.includes(term.status)) {
          const period = this.formatAggregationPeriod(term.payment_receive_date, aggregation);
          addRevenue(period, 'orderRevenue', term.calculated_amount || 0);
        }
      }
    }

    // 2. AMC Revenue
    const amcQuery: any = {};
    if (filters.clientIds?.length > 0) {
      amcQuery.client_id = { $in: this.convertToObjectIdArray(filters.clientIds) };
    }
    if (filters.productIds?.length > 0) {
      amcQuery.products = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const amcs = await this.amcModel.find(amcQuery).lean();
    for (const amc of amcs) {
      for (const payment of amc.payments || []) {
        const paymentDate = payment.status === PAYMENT_STATUS_ENUM.PAID 
          ? payment.received_date 
          : payment.from_date;
        if (paymentDate >= start && paymentDate <= end && paidStatuses.includes(payment.status)) {
          const period = this.formatAggregationPeriod(paymentDate, aggregation);
          const amount = payment.amc_rate_amount || payment.total_cost || amc.amount || 0;
          addRevenue(period, 'amcRevenue', amount);
        }
      }
    }

    // 3. Customization Revenue
    const customizationQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };
    
    const customizations = await this.customizationModel
      .find(customizationQuery)
      .populate('order_id')
      .lean();
      
    for (const cust of customizations) {
      if (filters.clientIds?.length > 0) {
        const orderClientId = this.toStringId((cust.order_id as any)?.client_id);
        if (!filters.clientIds.includes(orderClientId)) continue;
      }
      if (filters.productIds?.length > 0) {
        const prodId = this.toStringId(cust.product_id);
        if (!filters.productIds.includes(prodId)) continue;
      }
      const period = this.formatAggregationPeriod(cust.payment_receive_date, aggregation);
      addRevenue(period, 'customizationRevenue', cust.cost || 0);
    }

    // 4. License Revenue
    const licenseQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };
    
    const licenses = await this.licenseModel
      .find(licenseQuery)
      .populate('order_id')
      .lean();
      
    for (const license of licenses) {
      if (filters.clientIds?.length > 0) {
        const orderClientId = this.toStringId((license.order_id as any)?.client_id);
        if (!filters.clientIds.includes(orderClientId)) continue;
      }
      if (filters.productIds?.length > 0) {
        const prodId = this.toStringId(license.product_id);
        if (!filters.productIds.includes(prodId)) continue;
      }
      const period = this.formatAggregationPeriod(license.payment_receive_date, aggregation);
      const amount = (license.rate?.amount || 0) * (license.total_license || 0);
      addRevenue(period, 'licenseRevenue', amount);
    }

    // 5. Additional Service Revenue
    const serviceQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };
    
    const services = await this.additionalServiceModel
      .find(serviceQuery)
      .populate('order_id')
      .lean();
      
    for (const service of services) {
      if (filters.clientIds?.length > 0) {
        const orderClientId = this.toStringId((service.order_id as any)?.client_id);
        if (!filters.clientIds.includes(orderClientId)) continue;
      }
      if (filters.productIds?.length > 0) {
        const prodId = this.toStringId(service.product_id);
        if (!filters.productIds.includes(prodId)) continue;
      }
      const period = this.formatAggregationPeriod(service.payment_receive_date, aggregation);
      addRevenue(period, 'serviceRevenue', service.cost || 0);
    }

    // Convert map to array and calculate total revenue
    const result = Array.from(revenueMap.values()).map((item) => ({
      ...item,
      revenue: item.orderRevenue + item.amcRevenue + item.customizationRevenue + 
               item.licenseRevenue + item.serviceRevenue,
    }));

    // Sort by period
    return result.sort((a, b) => a.period.localeCompare(b.period));
  }

  private async getAMCDrillDown(
    filters: DrillDownFiltersDto,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<any[]> {
    // AMC drilldown shows Expected (Orders) vs Collected (AMC)
    // Expected = Order Revenue + AMC Expected
    // Collected = AMC Collected

    const aggregation = filters.aggregation || this.getAggregationFromFilter(filters.filter);
    const paidStatuses = filters.paymentStatuses?.length > 0
      ? filters.paymentStatuses
      : [PAYMENT_STATUS_ENUM.PAID];

    const [start, end] = [dateRange.startDate, dateRange.endDate];
    const revenueMap = new Map<string, any>();

    const addRevenue = (period: string, stream: string, amount: number) => {
      if (!revenueMap.has(period)) {
        revenueMap.set(period, {
          period,
          orderRevenue: 0,  // This represents "Expected" in AMC context
          amcRevenue: 0,    // This represents "Collected" in AMC context
          customizationRevenue: 0,
          licenseRevenue: 0,
          serviceRevenue: 0,
        });
      }
      const entry = revenueMap.get(period);
      entry[stream] = (entry[stream] || 0) + amount;
    };

    // 1. Order Revenue (Expected component)
    const orderQuery: any = {
      'payment_terms.payment_receive_date': { $gte: start, $lte: end },
    };
    if (filters.clientIds?.length > 0) {
      orderQuery.client_id = { $in: this.convertToObjectIdArray(filters.clientIds) };
    }
    if (filters.productIds?.length > 0) {
      orderQuery.products = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const orders = await this.orderModel.find(orderQuery).lean();
    for (const order of orders) {
      for (const term of order.payment_terms || []) {
        if (term.payment_receive_date >= start && 
            term.payment_receive_date <= end && 
            paidStatuses.includes(term.status)) {
          const period = this.formatAggregationPeriod(term.payment_receive_date, aggregation);
          addRevenue(period, 'orderRevenue', term.calculated_amount || 0);
        }
      }
    }

    // 2. AMC Revenue (Collected component)
    const amcQuery: any = {};
    if (filters.clientIds?.length > 0) {
      amcQuery.client_id = { $in: this.convertToObjectIdArray(filters.clientIds) };
    }
    if (filters.productIds?.length > 0) {
      amcQuery.products = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const amcs = await this.amcModel.find(amcQuery).lean();
    for (const amc of amcs) {
      for (const payment of amc.payments || []) {
        const paymentDate = payment.status === PAYMENT_STATUS_ENUM.PAID 
          ? payment.received_date 
          : payment.from_date;
        if (paymentDate >= start && paymentDate <= end && paidStatuses.includes(payment.status)) {
          const period = this.formatAggregationPeriod(paymentDate, aggregation);
          const amount = payment.amc_rate_amount || payment.total_cost || amc.amount || 0;
          addRevenue(period, 'amcRevenue', amount);
        }
      }
    }

    // Convert to array - for AMC drilldown, we primarily care about orderRevenue (Expected) and amcRevenue (Collected)
    const result = Array.from(revenueMap.values()).map((item) => ({
      ...item,
      revenue: item.orderRevenue + item.amcRevenue, // Total = Expected + Collected for context
    }));

    return result.sort((a, b) => a.period.localeCompare(b.period));
  }

  private async getTransactionDetails(
    filters: DrillDownFiltersDto,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<any[]> {
    const paidStatuses = filters.paymentStatuses?.length > 0
      ? filters.paymentStatuses
      : [PAYMENT_STATUS_ENUM.PAID];
    const [start, end] = [dateRange.startDate, dateRange.endDate];
    const transactions: any[] = [];

    // Get clients in target industry for filtering
    let industryClientIds: string[] = [];
    if (filters.industries?.length > 0) {
      const clients = await this.clientModel
        .find({ industry: { $in: filters.industries } })
        .select('_id')
        .lean();
      industryClientIds = clients.map((c: any) => c._id.toString());
    }

    // 1. Order Transactions
    const orderQuery: any = {
      'payment_terms.payment_receive_date': { $gte: start, $lte: end },
    };
    if (filters.clientIds?.length > 0) {
      orderQuery.client_id = { $in: this.convertToObjectIdArray(filters.clientIds) };
    }
    if (industryClientIds.length > 0) {
      orderQuery.client_id = { $in: this.convertToObjectIdArray([...(filters.clientIds || []), ...industryClientIds]) };
    }
    if (filters.productIds?.length > 0) {
      orderQuery.products = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const orders = await this.orderModel
      .find(orderQuery)
      .populate({ path: 'client_id', select: 'name industry' })
      .populate({ path: 'products', select: 'name' })
      .lean();

    for (const order of orders) {
      for (const term of order.payment_terms || []) {
        if (term.payment_receive_date >= start && 
            term.payment_receive_date <= end && 
            paidStatuses.includes(term.status)) {
          const products = (order.products as any[])?.map((p: any) => p.name).join(', ') || '';
          transactions.push({
            id: order._id.toString(),
            type: 'order',
            date: term.payment_receive_date,
            client: (order.client_id as any)?.name || '',
            product: products,
            amount: term.calculated_amount || 0,
            status: term.status,
            industry: (order.client_id as any)?.industry || '',
          });
        }
      }
    }

    // 2. AMC Transactions
    const amcQuery: any = {};
    if (filters.clientIds?.length > 0) {
      amcQuery.client_id = { $in: this.convertToObjectIdArray(filters.clientIds) };
    }
    if (industryClientIds.length > 0) {
      amcQuery.client_id = { $in: this.convertToObjectIdArray([...(filters.clientIds || []), ...industryClientIds]) };
    }
    if (filters.productIds?.length > 0) {
      amcQuery.products = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const amcs = await this.amcModel
      .find(amcQuery)
      .populate({ path: 'client_id', select: 'name industry' })
      .populate({ path: 'products', select: 'name' })
      .lean();

    for (const amc of amcs) {
      for (const payment of amc.payments || []) {
        const paymentDate = payment.status === PAYMENT_STATUS_ENUM.PAID 
          ? payment.received_date 
          : payment.from_date;
        if (paymentDate >= start && paymentDate <= end && paidStatuses.includes(payment.status)) {
          const products = (amc.products as any[])?.map((p: any) => p.name).join(', ') || '';
          transactions.push({
            id: amc._id.toString(),
            type: 'amc',
            date: paymentDate,
            client: (amc.client_id as any)?.name || '',
            product: products,
            amount: payment.amc_rate_amount || payment.total_cost || amc.amount || 0,
            status: payment.status,
            industry: (amc.client_id as any)?.industry || '',
          });
        }
      }
    }

    // 3. Customization Transactions
    const customizationQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };
    if (filters.productIds?.length > 0) {
      customizationQuery.product_id = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const customizations = await this.customizationModel
      .find(customizationQuery)
      .populate({ path: 'product_id', select: 'name' })
      .populate({ 
        path: 'order_id', 
        select: 'client_id',
        populate: { path: 'client_id', select: 'name industry' }
      })
      .lean();

    for (const cust of customizations) {
      const order = cust.order_id as any;
      const clientId = this.toStringId(order?.client_id?._id);
      if (filters.clientIds?.length > 0 && !filters.clientIds.includes(clientId)) continue;
      if (industryClientIds.length > 0 && !industryClientIds.includes(clientId)) continue;
      
      transactions.push({
        id: cust._id.toString(),
        type: 'customization',
        date: cust.payment_receive_date,
        client: order?.client_id?.name || '',
        product: (cust.product_id as any)?.name || '',
        amount: cust.cost || 0,
        status: cust.payment_status,
        industry: order?.client_id?.industry || '',
      });
    }

    // 4. License Transactions
    const licenseQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };
    if (filters.productIds?.length > 0) {
      licenseQuery.product_id = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const licenses = await this.licenseModel
      .find(licenseQuery)
      .populate({ path: 'product_id', select: 'name' })
      .populate({ 
        path: 'order_id', 
        select: 'client_id',
        populate: { path: 'client_id', select: 'name industry' }
      })
      .lean();

    for (const license of licenses) {
      const order = license.order_id as any;
      const clientId = this.toStringId(order?.client_id?._id);
      if (filters.clientIds?.length > 0 && !filters.clientIds.includes(clientId)) continue;
      if (industryClientIds.length > 0 && !industryClientIds.includes(clientId)) continue;
      
      transactions.push({
        id: license._id.toString(),
        type: 'license',
        date: license.payment_receive_date,
        client: order?.client_id?.name || '',
        product: (license.product_id as any)?.name || '',
        amount: (license.rate?.amount || 0) * (license.total_license || 0),
        status: license.payment_status,
        industry: order?.client_id?.industry || '',
      });
    }

    // 5. Additional Service Transactions
    const serviceQuery: any = {
      payment_receive_date: { $gte: start, $lte: end },
      payment_status: { $in: paidStatuses },
    };
    if (filters.productIds?.length > 0) {
      serviceQuery.product_id = { $in: this.convertToObjectIdArray(filters.productIds) };
    }

    const services = await this.additionalServiceModel
      .find(serviceQuery)
      .populate({ path: 'product_id', select: 'name' })
      .populate({ 
        path: 'order_id', 
        select: 'client_id',
        populate: { path: 'client_id', select: 'name industry' }
      })
      .lean();

    for (const service of services) {
      const order = service.order_id as any;
      const clientId = this.toStringId(order?.client_id?._id);
      if (filters.clientIds?.length > 0 && !filters.clientIds.includes(clientId)) continue;
      if (industryClientIds.length > 0 && !industryClientIds.includes(clientId)) continue;
      
      transactions.push({
        id: service._id.toString(),
        type: 'service',
        date: service.payment_receive_date,
        client: order?.client_id?.name || '',
        product: (service.product_id as any)?.name || '',
        amount: service.cost || 0,
        status: service.payment_status,
        industry: order?.client_id?.industry || '',
      });
    }

    // Sort by date descending
    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private async getTotalBussinessRevenue(
    filter: string,
    options?: any,
  ): Promise<any[]> {
    const [start, end] = [
      this.calculateDateRange(filter, options).startDate,
      this.calculateDateRange(filter, options).endDate,
    ];

    const groupByPeriod = (date: Date) => {
      const dateObj = new Date(date);
      switch (filter) {
        case 'monthly':
          return dateObj.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
          });
        case 'yearly':
          const dateYear = dateObj.getFullYear();
          const dateMonth = dateObj.getMonth();
          const fiscalYearStart = dateMonth < 3 ? dateYear - 1 : dateYear;
          return `FY${fiscalYearStart.toString().slice(-2)}-${(fiscalYearStart + 1).toString().slice(-2)}`;
        default:
          return 'All Time';
      }
    };

    const billingMap = new Map<
      string,
      { totalPurchaseBilling: number; totalAMCBilling: number }
    >();

    const addBilling = (
      date: Date,
      billing: { purchase?: number; amc?: number },
    ) => {
      if (date < start || date > end) return;
      const period = groupByPeriod(date);
      if (!billingMap.has(period)) {
        billingMap.set(period, { totalPurchaseBilling: 0, totalAMCBilling: 0 });
      }
      const entry = billingMap.get(period)!;
      if (billing.purchase) entry.totalPurchaseBilling += billing.purchase;
      if (billing.amc) entry.totalAMCBilling += billing.amc;
    };

    const orders = await this.orderModel
      .find({ payment_terms: { $exists: true } })
      .lean();
    for (const order of orders) {
      for (const term of order.payment_terms || []) {
        addBilling(term.payment_receive_date, {
          purchase: term.calculated_amount || 0,
        });
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
        addBilling(payment.from_date, {
          amc: payment.total_cost || amc.amount || 0,
        });
      }
    }

    return Array.from(billingMap.entries()).map(([period, data]) => ({
      period,
      total_amc_billing: data.totalAMCBilling,
      total_purchase_billing: data.totalPurchaseBilling,
    }));
  }

  private async getExpectedVsReceivedChartData(
    filter: string,
    options?: any,
  ): Promise<any[]> {
    const [start, end] = [
      this.calculateDateRange(filter, options).startDate,
      this.calculateDateRange(filter, options).endDate,
    ];

    const billingMap = new Map<
      string,
      { expected: number; received: number }
    >();

    const addBilling = (date: Date, expected: number, received: number) => {
      if (date < start || date > end) return;
      const dateObj = new Date(date);
      const period = dateObj.toLocaleString('default', {
        month: 'short',
        year: '2-digit',
      });
      if (!billingMap.has(period)) {
        billingMap.set(period, { expected: 0, received: 0 });
      }
      const entry = billingMap.get(period)!;
      entry.expected += expected;
      entry.received += received;
    };

    const orders = await this.orderModel
      .find({ payment_terms: { $exists: true } })
      .lean();
    for (const order of orders) {
      for (const term of order.payment_terms || []) {
        addBilling(
          term.payment_receive_date,
          term.calculated_amount || 0,
          term.calculated_amount || 0,
        );
      }
    }

    return Array.from(billingMap.entries()).map(([period, data]) => ({
      period,
      expected_amount: data.expected,
      received_amount: data.received,
    }));
  }

  private async getAMCAnnualBreakdown(
    filter: string,
    options?: any,
  ): Promise<any[]> {
    const [start, end] = [
      this.calculateDateRange(filter, options).startDate,
      this.calculateDateRange(filter, options).endDate,
    ];

    const breakdownMap = new Map<
      string,
      { totalExpected: number; totalCollected: number }
    >();

    const amcs = await this.amcModel.find().lean();
    for (const amc of amcs) {
      for (const payment of amc.payments || []) {
        if (payment.from_date >= start && payment.from_date <= end) {
          const dateObj = new Date(payment.from_date);
          const period = dateObj.toLocaleString('default', {
            month: 'short',
            year: '2-digit',
          });
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

  private async getProductWiseRevenueDistribution(
    filter: string,
    options?: any,
  ): Promise<any[]> {
    const [start, end] = [
      this.calculateDateRange(filter, options).startDate,
      this.calculateDateRange(filter, options).endDate,
    ];

    const dateFilter =
      filter === 'all' ? {} : { purchased_date: { $gte: start, $lte: end } };

    const orders = await this.orderModel
      .find(dateFilter)
      .populate('products')
      .lean();
    const productsRevenueMap = new Map<
      string,
      { product: any; revenue: number }
    >();

    for (const order of orders) {
      if (!order.products || order.products.length === 0) continue;

      const productIds = order.products.map((p: any) => p.toString());
      const productRevenues = new Map<string, number>();

      if (order.products.length === 1) {
        const productId = productIds[0];
        productRevenues.set(productId, order.base_cost || 0);
      } else {
        if (
          order.base_cost_seperation &&
          order.base_cost_seperation.length > 0
        ) {
          order.base_cost_seperation.forEach((sep: any) => {
            const productId = sep.product_id.toString();
            productRevenues.set(productId, sep.amount || 0);
          });
        } else {
          const amountPerProduct =
            (order.base_cost || 0) / order.products.length;
          productIds.forEach((productId: string) => {
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

    const productsRevenueArray = Array.from(productsRevenueMap.values()).filter(
      (pr) => pr.product,
    );
    const totalRevenue = productsRevenueArray.reduce(
      (sum, pr) => sum + pr.revenue,
      0,
    );

    return productsRevenueArray.map((pr) => ({
      productId: pr.product._id,
      productName: pr.product.name,
      revenue: pr.revenue,
      percentage: totalRevenue > 0 ? (pr.revenue / totalRevenue) * 100 : 0,
    }));
  }

  private async getIndustryWiseRevenueDistribution(
    filter: string,
    options?: any,
  ): Promise<any[]> {
    const [start, end] = [
      this.calculateDateRange(filter, options).startDate,
      this.calculateDateRange(filter, options).endDate,
    ];

    const industryMap = new Map<string, number>();

    const orders = await this.orderModel
      .find({
        purchased_date: { $gte: start, $lte: end },
      })
      .populate('client_id')
      .lean();

    for (const order of orders) {
      if (order.client_id && (order.client_id as any).industry) {
        const industry = (order.client_id as any).industry;
        industryMap.set(
          industry,
          (industryMap.get(industry) || 0) + (order.base_cost || 0),
        );
      }
    }

    const resultArray = Array.from(industryMap.entries()).map(
      ([industry, total]) => ({
        industry,
        total,
      }),
    );

    return resultArray.sort((a, b) => b.total - a.total);
  }

  private async getClientWiseRevenueDistribution(
    filter: string,
    options?: any,
  ): Promise<{ clientId: string; clientName: string; revenue: number }[]> {
    const [start, end] = [
      this.calculateDateRange(filter, options).startDate,
      this.calculateDateRange(filter, options).endDate,
    ];

    const clientRevenueMap = new Map<
      string,
      { clientId: string; clientName: string; revenue: number }
    >();

    const addRevenue = (clientId: string, clientName: string, amount: number) => {
      const existing = clientRevenueMap.get(clientId);
      if (existing) {
        existing.revenue += amount;
      } else {
        clientRevenueMap.set(clientId, { clientId, clientName, revenue: amount });
      }
    };

    // 1. Order Revenue
    const orders = await this.orderModel
      .find({
        purchased_date: { $gte: start, $lte: end },
      })
      .populate('client_id', 'name')
      .lean();

    for (const order of orders) {
      const clientId = this.toStringId((order.client_id as any)?._id);
      const clientName = (order.client_id as any)?.name || 'Unknown';
      if (clientId) {
        addRevenue(clientId, clientName, order.base_cost || 0);
      }
    }

    // 2. AMC Revenue
    const amcs = await this.amcModel
      .find({
        'payments.from_date': { $gte: start, $lte: end },
      })
      .populate('client_id', 'name')
      .lean();

    for (const amc of amcs) {
      const clientId = this.toStringId((amc.client_id as any)?._id);
      const clientName = (amc.client_id as any)?.name || 'Unknown';
      if (!clientId) continue;

      for (const payment of amc.payments || []) {
        const amount = payment.amc_rate_amount || payment.total_cost || amc.amount || 0;
        addRevenue(clientId, clientName, amount);
      }
    }

    // 3. Customization Revenue
    const customizations = await this.customizationModel
      .find({
        payment_receive_date: { $gte: start, $lte: end },
      })
      .populate({
        path: 'order_id',
        select: 'client_id',
        populate: { path: 'client_id', select: 'name' },
      })
      .lean();

    for (const cust of customizations) {
      const order = cust.order_id as any;
      const clientId = this.toStringId(order?.client_id?._id);
      const clientName = order?.client_id?.name || 'Unknown';
      if (clientId) {
        addRevenue(clientId, clientName, cust.cost || 0);
      }
    }

    // 4. License Revenue
    const licenses = await this.licenseModel
      .find({
        payment_receive_date: { $gte: start, $lte: end },
      })
      .populate({
        path: 'order_id',
        select: 'client_id',
        populate: { path: 'client_id', select: 'name' },
      })
      .lean();

    for (const license of licenses) {
      const order = license.order_id as any;
      const clientId = this.toStringId(order?.client_id?._id);
      const clientName = order?.client_id?.name || 'Unknown';
      if (clientId) {
        const amount = (license.rate?.amount || 0) * (license.total_license || 0);
        addRevenue(clientId, clientName, amount);
      }
    }

    // 5. Additional Service Revenue
    const services = await this.additionalServiceModel
      .find({
        payment_receive_date: { $gte: start, $lte: end },
      })
      .populate({
        path: 'order_id',
        select: 'client_id',
        populate: { path: 'client_id', select: 'name' },
      })
      .lean();

    for (const service of services) {
      const order = service.order_id as any;
      const clientId = this.toStringId(order?.client_id?._id);
      const clientName = order?.client_id?.name || 'Unknown';
      if (clientId) {
        addRevenue(clientId, clientName, service.cost || 0);
      }
    }

    // Convert to array and sort by revenue descending
    return Array.from(clientRevenueMap.values()).sort((a, b) => b.revenue - a.revenue);
  }
}
