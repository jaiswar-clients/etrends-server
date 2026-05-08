import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { Order, OrderDocument } from '@/db/schema/order/product-order.schema';
import { License, LicenseDocument } from '@/db/schema/order/license.schema';
import { Customization, CustomizationDocument } from '@/db/schema/order/customization.schema';
import { Product, ProductDocument } from '@/db/schema/product.schema';
import { Client, ClientDocument } from '@/db/schema/client.schema';
import { AMC, AMCDocument, PAYMENT_STATUS_ENUM } from '@/db/schema/amc/amc.schema';
import {
  IRevenueDashboardResponse,
  IMonthlyRevenueBreakdown,
  IExpectedVsCollectedResponse,
  IPeriodBreakdown,
  IMonthlyBreakdown,
  IMonthlyBreakdownDetail,
  IRevenueDashboardQuery,
  IExpectedVsCollectedQuery,
  IMonthlyBreakdownQuery,
  IClientHealthMetrics,
  IClientRevenueData,
  ITopPerformersResponse,
  IIndustryBreakdown,
  IClientConcentrationRisk,
  IClientHealthDashboardResponse,
} from '../dto/revenue-report.dto';

@Injectable()
export class RevenueCalculatorService {
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
    @InjectModel(AMC.name)
    private amcModel: SoftDeleteModel<AMCDocument>,
  ) {}

  /**
   * Check if an order qualifies as a new sale
   * New Sale = Any new product order (NOT AMC renewal payments)
   */
  isNewSaleOrder(order: any): boolean {
    // An order is a new sale if it has products and is not just an AMC renewal
    // AMC renewals are tracked in AMC.payments, not as new orders
    return order.products && order.products.length > 0;
  }

  /**
   * Calculate total revenue for a new sale order
   * Uses payment_terms with status 'paid' or 'invoice' instead of base_cost
   */
  async calculateNewSaleOrderRevenue(order: any): Promise<number> {
    let totalRevenue = 0;

    // Sum payment_terms where status is 'paid' or 'invoice'
    const revenuePaymentTerms = (order.payment_terms || []).filter(
      (term: any) => term.status === 'paid' || term.status === 'invoice'
    );
    totalRevenue += revenuePaymentTerms.reduce(
      (sum: number, term: any) => sum + (term.calculated_amount || 0),
      0
    );

    return totalRevenue;
  }

  /**
   * Get date range for a fiscal year (April 1 to March 31)
   */
  getFiscalYearRange(fiscalYearStart: number): { start: Date; end: Date } {
    // Fiscal year starts April 1 of the start year and ends March 31 of the next year
    const start = new Date(fiscalYearStart, 3, 1); // April 1
    const end = new Date(fiscalYearStart + 1, 2, 31, 23, 59, 59); // March 31
    return { start, end };
  }

  /**
   * Get period label based on date and filter type
   */
  getPeriodLabel(date: Date, filter: string): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    switch (filter) {
      case 'monthly': {
        const month = date.getMonth();
        const year = date.getFullYear();
        const fiscalYear = month >= 3 ? year : year - 1;
        const fyLabel = `FY${(fiscalYear % 100).toString().padStart(2, '0')}-${((fiscalYear + 1) % 100).toString().padStart(2, '0')}`;
        return `${monthNames[month]} ${fyLabel}`;
      }
      case 'quarterly': {
        const month = date.getMonth();
        const year = date.getFullYear();
        const fiscalYear = month >= 3 ? year : year - 1;
        const quarter = Math.floor((month + 9) % 12 / 3) + 1;
        const fyLabel = `FY${(fiscalYear % 100).toString().padStart(2, '0')}-${((fiscalYear + 1) % 100).toString().padStart(2, '0')}`;
        return `Q${quarter} ${fyLabel}`;
      }
      case 'yearly': {
        const month = date.getMonth();
        const year = date.getFullYear();
        const fiscalYear = month >= 3 ? year : year - 1;
        return `FY${(fiscalYear % 100).toString().padStart(2, '0')}-${((fiscalYear + 1) % 100).toString().padStart(2, '0')}`;
      }
      default:
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    }
  }

  /**
   * Calculate New Sales Revenue by period
   */
  async calculateNewSalesRevenue(
    startDate: Date,
    endDate: Date,
    filter: string = 'monthly',
  ): Promise<Map<string, number>> {
    const orders = await this.orderModel
      .find({
        purchased_date: { $gte: startDate, $lte: endDate },
        deleted: { $ne: true },
      })
      .populate('products')
      .lean();

    const revenueByPeriod = new Map<string, number>();

    let debugNewSalesOrders = 0;
    let debugNewSalesTerms = 0;
    let debugNoInvoice = 0;
    let debugProforma = 0;
    let debugWrongStatus = 0;

    // FIX 1: Iterate payment_terms directly and group by term.invoice_date
    for (const order of orders) {
      if (this.isNewSaleOrder(order)) {
        debugNewSalesOrders++;
        for (const term of order.payment_terms || []) {
          debugNewSalesTerms++;
          if (!term.invoice_date) { debugNoInvoice++; continue; }
          if (term.status === 'proforma') { debugProforma++; continue; }
          if (term.status !== 'paid' && term.status !== 'invoice') { debugWrongStatus++; continue; }

          const revenue = term.calculated_amount || 0;
          const period = this.getPeriodLabel(new Date(term.invoice_date), filter);
          revenueByPeriod.set(period, (revenueByPeriod.get(period) || 0) + revenue);
        }
      }
    }

    console.log('[DEBUG calculateNewSalesRevenue]', {
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      ordersFound: orders.length,
      newSaleOrders: debugNewSalesOrders,
      totalTerms: debugNewSalesTerms,
      noInvoice: debugNoInvoice,
      proforma: debugProforma,
      wrongStatus: debugWrongStatus,
      periods: Array.from(revenueByPeriod.entries()),
    });

    return revenueByPeriod;
  }

  /**
   * Calculate AMC Revenue by period
   * EXCLUDES first payment (free maintenance period)
   */
  async calculateAMCRevenue(
    startDate: Date,
    endDate: Date,
    filter: string = 'monthly',
  ): Promise<Map<string, number>> {
    // mongoose-delete overrides find() to auto-exclude deleted docs.
    // Use findWithDeleted() to include soft-deleted AMCs in revenue calculations.
    const amcs = await (this.amcModel as any)
      .findWithDeleted()
      .populate({ path: 'order_id', model: 'Order' })
      .lean();

    console.log('[DEBUG calculateAMCRevenue] raw AMC count (withDeleted):', amcs.length);
    console.log('[DEBUG calculateAMCRevenue] deleted breakdown:', amcs.reduce((acc: any, a: any) => {
      acc[String(a.deleted ?? 'undefined')] = (acc[String(a.deleted ?? 'undefined')] || 0) + 1;
      return acc;
    }, {}));
    console.log('[DEBUG calculateAMCRevenue] payment counts:', amcs.map((a: any) => ({ _id: a._id, deleted: a.deleted, paymentsCount: (a.payments || []).length })));

    const revenueByPeriod = new Map<string, number>();

    // DEBUG: trace why AMC revenue is zero
    let debugTotalAmcs = 0;
    let debugTotalPayments = 0;
    let debugProformaSkipped = 0;
    let debugOutOfRange = 0;
    let debugZeroAmount = 0;
    let debugAdded = 0;
    let debugAddedAmount = 0;

    for (const amc of amcs) {
      debugTotalAmcs++;
      const order = amc.order_id as any;

      // Include all payments (first payment is now paid AMC, not free period)
      const allPayments = amc.payments || [];

      for (const payment of allPayments) {
        debugTotalPayments++;
        // Skip proforma payments
        // if (payment.status === 'proforma') {
        //   debugProformaSkipped++;
        //   continue;
        // }

        const paymentFromDate = new Date(payment.from_date);

        // Check if payment falls within date range (range eligibility check)
        if (paymentFromDate < startDate || paymentFromDate > endDate) {
          debugOutOfRange++;
          continue;
        }

        // Use amc_rate_amount from payment record
        const revenue = payment.amc_rate_amount || 0;
        if (revenue === 0) {
          debugZeroAmount++;
        }
        // Group by order.amc_start_date when available, fallback to payment.from_date
        const groupDate = order?.amc_start_date ? new Date(order.amc_start_date) : paymentFromDate;
        const period = this.getPeriodLabel(groupDate, filter);
        revenueByPeriod.set(period, (revenueByPeriod.get(period) || 0) + revenue);
        debugAdded++;
        debugAddedAmount += revenue;
      }
    }

    console.log('[DEBUG calculateAMCRevenue]', {
      filter,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalAmcs: debugTotalAmcs,
      totalPayments: debugTotalPayments,
      proformaSkipped: debugProformaSkipped,
      outOfRange: debugOutOfRange,
      zeroAmount: debugZeroAmount,
      added: debugAdded,
      addedAmount: debugAddedAmount,
      periods: Array.from(revenueByPeriod.entries()),
    });

    return revenueByPeriod;
  }

  /**
   * Get all unique periods and sort them
   */
  sortPeriods(periods: string[]): string[] {
    return [...new Set(periods)].sort((a, b) => {
      // Extract fiscal year and period info for sorting
      const fyPattern = /FY(\d{2})-(\d{2})/;
      const aMatch = a.match(fyPattern);
      const bMatch = b.match(fyPattern);

      if (aMatch && bMatch) {
        const aFY = parseInt(aMatch[1]);
        const bFY = parseInt(bMatch[1]);
        if (aFY !== bFY) return aFY - bFY;

        // Same fiscal year - sort by quarter/month
        const getSortOrder = (p: string) => {
          if (p.includes('Q1')) return 1;
          if (p.includes('Q2')) return 2;
          if (p.includes('Q3')) return 3;
          if (p.includes('Q4')) return 4;

          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          for (let i = 0; i < months.length; i++) {
            if (p.includes(months[i])) return i + 10;
          }
          return 99;
        };

        return getSortOrder(a) - getSortOrder(b);
      }
      return a.localeCompare(b);
    });
  }

  /**
   * Main Revenue Dashboard endpoint
   */
  async getRevenueDashboard(query: IRevenueDashboardQuery): Promise<IRevenueDashboardResponse> {
    const { filter = 'monthly', year, quarter, startDate, endDate } = query;

    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else if (year) {
      const range = this.getFiscalYearRange(year);
      start = range.start;
      end = range.end;

      // Adjust for quarter if specified
      if (quarter) {
        const quarterNum = parseInt(quarter.split(' ')[0].replace('Q', ''));
        switch (quarterNum) {
          case 1: // Apr-Jun
            start = new Date(year, 3, 1);
            end = new Date(year, 5, 30, 23, 59, 59);
            break;
          case 2: // Jul-Sep
            start = new Date(year, 6, 1);
            end = new Date(year, 8, 30, 23, 59, 59);
            break;
          case 3: // Oct-Dec
            start = new Date(year, 9, 1);
            end = new Date(year, 11, 31, 23, 59, 59);
            break;
          case 4: // Jan-Mar
            start = new Date(year + 1, 0, 1);
            end = new Date(year + 1, 2, 31, 23, 59, 59);
            break;
        }
      }
    } else {
      // Default to current fiscal year
      const now = new Date();
      const currentFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const range = this.getFiscalYearRange(currentFYStart);
      start = range.start;
      end = range.end;
    }

    // Calculate revenues
    const newSalesRevenue = await this.calculateNewSalesRevenue(start, end, filter);
    const amcRevenue = await this.calculateAMCRevenue(start, end, filter);

    // Combine all periods
    const allPeriods = this.sortPeriods([
      ...newSalesRevenue.keys(),
      ...amcRevenue.keys(),
    ]);

    // Build monthly breakdown
    const monthlyBreakdown: IMonthlyRevenueBreakdown[] = allPeriods.map((period) => {
      const newSales = newSalesRevenue.get(period) || 0;
      const amc = amcRevenue.get(period) || 0;
      return {
        period,
        newSalesRevenue: newSales,
        amcRevenue: amc,
        totalRevenue: newSales + amc,
      };
    });

    // Calculate summary
    const summary = {
      totalNewSalesRevenue: monthlyBreakdown.reduce((sum, m) => sum + m.newSalesRevenue, 0),
      totalAMCRevenue: monthlyBreakdown.reduce((sum, m) => sum + m.amcRevenue, 0),
      grandTotalRevenue: monthlyBreakdown.reduce((sum, m) => sum + m.totalRevenue, 0),
    };

    return {
      summary,
      monthlyBreakdown,
    };
  }

  /**
   * Expected vs Collected Revenue Report
   */
  async getExpectedVsCollected(query: IExpectedVsCollectedQuery): Promise<IExpectedVsCollectedResponse> {
    const { fiscalYear, filter = 'monthly' } = query;
    const { start, end } = this.getFiscalYearRange(fiscalYear);
    const fyLabel = `FY${(fiscalYear % 100).toString().padStart(2, '0')}-${((fiscalYear + 1) % 100).toString().padStart(2, '0')}`;

    // New Sales: Expected vs Collected
    const newSalesOrders = await this.orderModel
      .find({
        purchased_date: { $gte: start, $lte: end },
        deleted: { $ne: true },
      })
      .lean();

    const newSalesBreakdown: IPeriodBreakdown[] = [];
    let newSalesExpected = 0;
    let newSalesCollected = 0;

    // Group by month for breakdown
    const newSalesByPeriod = new Map<string, { expected: number; collected: number }>();

    // FIX 2: Iterate payment_terms directly and group by term.invoice_date
    for (const order of newSalesOrders) {
      if (this.isNewSaleOrder(order)) {
        for (const term of order.payment_terms || []) {
          if (!term.invoice_date) continue;
          if (term.status === 'proforma') continue;
          if (term.status !== 'paid' && term.status !== 'invoice') continue;

          const termAmount = term.calculated_amount || 0;
          const isPaid = term.status === 'paid';

          // Expected: all terms with status 'paid' or 'invoice'
          newSalesExpected += termAmount;
          // Collected: only terms with status 'paid'
          if (isPaid) {
            newSalesCollected += termAmount;
          }

          // Add to period breakdown grouped by invoice_date
          const period = this.getPeriodLabel(new Date(term.invoice_date), filter);
          const existing = newSalesByPeriod.get(period) || { expected: 0, collected: 0 };
          existing.expected += termAmount;
          if (isPaid) {
            existing.collected += termAmount;
          }
          newSalesByPeriod.set(period, existing);
        }
      }
    }

    // Convert to array
    const sortedPeriods = this.sortPeriods([...newSalesByPeriod.keys()]);
    for (const period of sortedPeriods) {
      const data = newSalesByPeriod.get(period)!;
      newSalesBreakdown.push({
        period,
        expected: data.expected,
        collected: data.collected,
      });
    }

    // AMC: Expected vs Collected
    const amcs = await (this.amcModel as any).findWithDeleted()
      .populate({ path: 'order_id', model: 'Order' })
      .lean();

    const amcBreakdown: IPeriodBreakdown[] = [];
    let amcExpected = 0;
    let amcCollected = 0;

    const amcByPeriod = new Map<string, { expected: number; collected: number }>();

    for (const amc of amcs) {
      const order = amc.order_id as any;

      // Include all payments (first payment is now paid AMC, not free period)
      const allPayments = amc.payments || [];

      for (const payment of allPayments) {
        // Skip proforma payments
        if (payment.status === 'proforma') continue;

        const paymentFromDate = new Date(payment.from_date);

        // Check if payment falls within date range (range eligibility check)
        if (paymentFromDate >= start && paymentFromDate <= end) {
          // Expected: calculated_amount (amc_rate_amount)
          const expected = payment.amc_rate_amount || 0;
          // Collected: only if status is PAID
          const collected = payment.status === PAYMENT_STATUS_ENUM.PAID ? expected : 0;

          amcExpected += expected;
          amcCollected += collected;

          // Group by order.amc_start_date when available, fallback to payment.from_date
          const groupDate = order?.amc_start_date ? new Date(order.amc_start_date) : paymentFromDate;
          const period = this.getPeriodLabel(groupDate, filter);
          const existing = amcByPeriod.get(period) || { expected: 0, collected: 0 };
          existing.expected += expected;
          existing.collected += collected;
          amcByPeriod.set(period, existing);
        }
      }
    }

    // Convert to array
    const amcSortedPeriods = this.sortPeriods([...amcByPeriod.keys()]);
    for (const period of amcSortedPeriods) {
      const data = amcByPeriod.get(period)!;
      amcBreakdown.push({
        period,
        expected: data.expected,
        collected: data.collected,
      });
    }

    return {
      fiscalYear: fyLabel,
      newSales: {
        expected: newSalesExpected,
        collected: newSalesCollected,
        breakdown: newSalesBreakdown,
      },
      amc: {
        expected: amcExpected,
        collected: amcCollected,
        breakdown: amcBreakdown,
      },
      total: {
        expected: newSalesExpected + amcExpected,
        collected: newSalesCollected + amcCollected,
      },
    };
  }

  /**
   * Calculate collected amount from payment terms
   * Includes both 'paid' and 'invoice' status
   */
  private calculateCollectedFromPaymentTerms(paymentTerms: any[]): number {
    return paymentTerms
      .filter((term) => term.status === 'paid' || term.status === 'invoice')
      .reduce((sum, term) => sum + (term.calculated_amount || 0), 0);
  }

  /**
   * Monthly Revenue Breakdown (Drill-down)
   */
  async getMonthlyBreakdown(query: IMonthlyBreakdownQuery): Promise<IMonthlyBreakdown> {
    const { year, month } = query;

    // Create date range for the month
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fiscalYear = month >= 4 ? year : year - 1;
    const fyLabel = `FY${(fiscalYear % 100).toString().padStart(2, '0')}-${((fiscalYear + 1) % 100).toString().padStart(2, '0')}`;
    const period = `${monthNames[month - 1]} ${fyLabel}`;

    // New Sales Details
    // FIX 3: The initial query filter on purchased_date can stay (it gets orders in range),
    // but after fetching, iterate payment_terms for revenue grouping
    const orders = await this.orderModel
      .find({
        purchased_date: { $gte: start, $lte: end },
        deleted: { $ne: true },
      })
      .populate('client_id')
      .populate('products')
      .lean();

    const newSalesDetails: IMonthlyBreakdownDetail[] = [];
    let newSalesTotal = 0;

    for (const order of orders) {
      if (this.isNewSaleOrder(order)) {
        const client = order.client_id as any;
        let products = order.products as any[];

        // Handle case where products might be stored as strings instead of ObjectIds
        // If populate didn't work (products are still IDs), fetch them manually
        if (products && products.length > 0 && typeof products[0] === 'string') {
          const productIds = products.map((id: string) => {
            try {
              return new Types.ObjectId(id);
            } catch {
              return id;
            }
          });
          products = await this.productModel.find({
            _id: { $in: productIds },
            deleted: { $ne: true },
          }).lean();
        }

        // Iterate payment_terms directly instead of calculateNewSaleOrderRevenue
        for (const term of order.payment_terms || []) {
          if (!term.invoice_date) continue;
          if (term.status === 'proforma') continue;
          if (term.status !== 'paid' && term.status !== 'invoice') continue;

          const revenue = term.calculated_amount || 0;
          newSalesTotal += revenue;

          newSalesDetails.push({
            orderId: order._id.toString(),
            clientName: client?.name || 'Unknown',
            productName: products?.map((p) => p?.name).filter(Boolean).join(', ') || 'N/A',
            amount: revenue,
            status: term.status || 'unknown',
            date: term.invoice_date,
          });
        }
      }
    }

    // AMC Details
    const amcs = await (this.amcModel as any).findWithDeleted()
      .populate('client_id')
      .populate({ path: 'order_id', model: 'Order' })
      .lean();

    const amcDetails: IMonthlyBreakdownDetail[] = [];
    let amcTotal = 0;

    for (const amc of amcs) {
      const order = amc.order_id as any;

      // Include all payments (first payment is now paid AMC, not free period)
      const allPayments = amc.payments || [];

      for (const payment of allPayments) {
        // Skip proforma payments
        if (payment.status === 'proforma') continue;

        const paymentFromDate = new Date(payment.from_date);

        // Check if payment falls within date range (range eligibility check)
        if (paymentFromDate >= start && paymentFromDate <= end) {
          const revenue = payment.amc_rate_amount || 0;
          amcTotal += revenue;

          const client = amc.client_id as any;

          amcDetails.push({
            orderId: amc.order_id?.toString() || amc._id.toString(),
            clientName: client?.name || 'Unknown',
            productName: 'AMC',
            amount: revenue,
            status: payment.status || 'unknown',
            date: order?.amc_start_date || payment.from_date,
          });
        }
      }
    }

    return {
      period,
      newSales: {
        total: newSalesTotal,
        details: newSalesDetails,
      },
      amc: {
        total: amcTotal,
        details: amcDetails,
      },
    };
  }

  // ==================== CLIENT HEALTH & RETENTION DASHBOARD METHODS ====================

  /**
   * Get Client Health Metrics
   */
  async getClientHealthMetrics(fiscalYear: number): Promise<IClientHealthMetrics> {
    const { start, end } = this.getFiscalYearRange(fiscalYear);

    // Get all non-deleted clients
    const allClients = await this.clientModel.find({ deleted: { $ne: true } }).lean();
    const totalClients = allClients.length;

    // Get clients with activity in current FY (orders or AMC payments)
    const ordersInFY = await this.orderModel
      .find({
        purchased_date: { $gte: start, $lte: end },
        deleted: { $ne: true },
      })
      .lean();

    const clientIdsWithOrders = new Set(ordersInFY.map((o) => o.client_id?.toString()));

    // Get AMC payments in FY
    const amcs = await (this.amcModel as any).findWithDeleted().lean();
    const clientIdsWithAMCPayments = new Set<string>();

    for (const amc of amcs) {
      const allPayments = amc.payments || [];
      for (const payment of allPayments) {
        if (payment.status === 'proforma') continue;
        const paymentDate = new Date(payment.from_date);
        if (paymentDate >= start && paymentDate <= end) {
          clientIdsWithAMCPayments.add(amc.client_id?.toString());
        }
      }
    }

    // Active clients have either orders or AMC payments in FY
    const activeClientIds = new Set([...clientIdsWithOrders, ...clientIdsWithAMCPayments]);
    const activeClients = activeClientIds.size;
    const inactiveClients = totalClients - activeClients;
    const activePercentage = totalClients > 0 ? (activeClients / totalClients) * 100 : 0;

    // Calculate overdue payments from orders (payment_terms with status 'pending')
    const allOrders = await this.orderModel.find({ deleted: { $ne: true } }).lean();
    const now = new Date();
    const overdue30Days: Set<string> = new Set();
    const overdue60Days: Set<string> = new Set();
    const overdue90Days: Set<string> = new Set();

    for (const order of allOrders) {
      const clientId = order.client_id?.toString();
      if (!clientId) continue;

      for (const term of order.payment_terms || []) {
        if (term.status !== 'paid' && term.invoice_date) {
          const invoiceDate = new Date(term.invoice_date);
          const daysOverdue = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysOverdue > 90) {
            overdue90Days.add(clientId);
          } else if (daysOverdue > 60) {
            overdue60Days.add(clientId);
          } else if (daysOverdue > 30) {
            overdue30Days.add(clientId);
          }
        }
      }
    }

    // AMC overdue payments
    for (const amc of amcs) {
      const clientId = amc.client_id?.toString();
      if (!clientId) continue;

      const allPayments = amc.payments || [];
      for (const payment of allPayments) {
        if (payment.status === 'proforma') continue;
        if (payment.status !== 'paid' && payment.invoice_date) {
          const invoiceDate = new Date(payment.invoice_date);
          const daysOverdue = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysOverdue > 90) {
            overdue90Days.add(clientId);
          } else if (daysOverdue > 60) {
            overdue60Days.add(clientId);
          } else if (daysOverdue > 30) {
            overdue30Days.add(clientId);
          }
        }
      }
    }

    // Calculate AMC renewal rate
    // AMCs with subsequent payments after period end (renewed)
    let totalAMCsDue = 0;
    let renewedAMCs = 0;

    for (const amc of amcs) {
      const payments = amc.payments || [];
      if (payments.length <= 0) continue;

      // Find payments that ended before or during the FY
      const allPayments = payments;
      for (let i = 0; i < allPayments.length; i++) {
        const payment = allPayments[i];
        if (payment.status === 'proforma') continue;
        const paymentEndDate = new Date(payment.to_date);

        // If this payment period ended within the FY
        if (paymentEndDate >= start && paymentEndDate <= end) {
          totalAMCsDue++;
          // Check if there's a subsequent payment (renewal)
          if (i + 1 < allPayments.length) {
            renewedAMCs++;
          }
        }
      }
    }

    const amcRenewalRate = totalAMCsDue > 0 ? (renewedAMCs / totalAMCsDue) * 100 : 100;

    return {
      totalClients,
      activeClients,
      inactiveClients,
      activePercentage,
      overdueClients: {
        over30Days: overdue30Days.size - overdue60Days.size,
        over60Days: overdue60Days.size - overdue90Days.size,
        over90Days: overdue90Days.size,
      },
      amcRenewalRate,
    };
  }

  /**
   * Get Top and At-Risk Performers
   */
  async getTopPerformers(fiscalYear: number, limit: number = 5): Promise<ITopPerformersResponse> {
    const { start, end } = this.getFiscalYearRange(fiscalYear);
    const prevFYStart = fiscalYear - 1;
    const { start: prevStart, end: prevEnd } = this.getFiscalYearRange(prevFYStart);

    // Get all clients
    const clients = await this.clientModel.find({ deleted: { $ne: true } }).lean();
    const clientMap = new Map(clients.map((c) => [c._id.toString(), c]));

    // Calculate current FY revenue by client
    const currentFYRevenue = new Map<string, { newSales: number; amc: number; orderCount: number }>();

    // FIX 4: New sales revenue - iterate payment_terms directly instead of calculateNewSaleOrderRevenue
    const orders = await this.orderModel
      .find({
        purchased_date: { $gte: start, $lte: end },
        deleted: { $ne: true },
      })
      .lean();

    for (const order of orders) {
      const clientId = order.client_id?.toString();
      if (!clientId) continue;

      if (this.isNewSaleOrder(order)) {
        for (const term of order.payment_terms || []) {
          if (!term.invoice_date) continue;
          if (term.status === 'proforma') continue;
          if (term.status !== 'paid' && term.status !== 'invoice') continue;

          const revenue = term.calculated_amount || 0;
          const existing = currentFYRevenue.get(clientId) || { newSales: 0, amc: 0, orderCount: 0 };
          existing.newSales += revenue;
          existing.orderCount++;
          currentFYRevenue.set(clientId, existing);
        }
      }
    }

    // AMC revenue
    const amcs = await (this.amcModel as any).findWithDeleted()
      .populate({ path: 'order_id', model: 'Order' })
      .lean();
    for (const amc of amcs) {
      const clientId = amc.client_id?.toString();
      if (!clientId) continue;

      const order = amc.order_id as any;

      const allPayments = amc.payments || [];
      for (const payment of allPayments) {
        // Skip proforma payments
        if (payment.status === 'proforma') continue;

        const paymentFromDate = new Date(payment.from_date);
        if (paymentFromDate >= start && paymentFromDate <= end) {
          const revenue = payment.amc_rate_amount || 0;
          const existing = currentFYRevenue.get(clientId) || { newSales: 0, amc: 0, orderCount: 0 };
          existing.amc += revenue;
          currentFYRevenue.set(clientId, existing);
        }
      }
    }

    // Calculate previous FY revenue by client
    const prevFYRevenue = new Map<string, number>();

    const prevOrders = await this.orderModel
      .find({
        purchased_date: { $gte: prevStart, $lte: prevEnd },
        deleted: { $ne: true },
      })
      .lean();

    // FIX 4 continued: Previous FY new sales - iterate payment_terms directly
    for (const order of prevOrders) {
      const clientId = order.client_id?.toString();
      if (!clientId) continue;

      if (this.isNewSaleOrder(order)) {
        for (const term of order.payment_terms || []) {
          if (!term.invoice_date) continue;
          if (term.status === 'proforma') continue;
          if (term.status !== 'paid' && term.status !== 'invoice') continue;

          const revenue = term.calculated_amount || 0;
          prevFYRevenue.set(clientId, (prevFYRevenue.get(clientId) || 0) + revenue);
        }
      }
    }

    for (const amc of amcs) {
      const clientId = amc.client_id?.toString();
      if (!clientId) continue;

      const order = amc.order_id as any;

      const allPayments = amc.payments || [];
      for (const payment of allPayments) {
        // Skip proforma payments
        if (payment.status === 'proforma') continue;

        const paymentFromDate = new Date(payment.from_date);
        if (paymentFromDate >= prevStart && paymentFromDate <= prevEnd) {
          const revenue = payment.amc_rate_amount || 0;
          prevFYRevenue.set(clientId, (prevFYRevenue.get(clientId) || 0) + revenue);
        }
      }
    }

    // Build client revenue data
    const clientRevenueData: IClientRevenueData[] = [];

    for (const [clientId, revenue] of currentFYRevenue) {
      const client = clientMap.get(clientId);
      if (!client) continue;

      const totalRevenue = revenue.newSales + revenue.amc;
      const prevRevenue = prevFYRevenue.get(clientId) || 0;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      let trendPercentage = 0;

      if (prevRevenue > 0) {
        trendPercentage = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
        if (trendPercentage > 5) trend = 'up';
        else if (trendPercentage < -5) trend = 'down';
      } else if (totalRevenue > 0) {
        trend = 'up';
        trendPercentage = 100;
      }

      // Determine if at-risk
      const riskFactors: string[] = [];

      if (trend === 'down' && trendPercentage < -20) {
        riskFactors.push('Revenue declining >20%');
      }

      // Check for late payments (overdue > 60 days)
      const clientOrders = await this.orderModel.find({ client_id: clientId, deleted: { $ne: true } }).lean();
      const now = new Date();
      let hasLatePayment = false;

      for (const order of clientOrders) {
        for (const term of order.payment_terms || []) {
          if (term.status !== 'paid' && term.invoice_date) {
            const invoiceDate = new Date(term.invoice_date);
            const daysOverdue = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysOverdue > 60) {
              hasLatePayment = true;
              break;
            }
          }
        }
        if (hasLatePayment) break;
      }

      // Check AMC late payments
      if (!hasLatePayment) {
        const clientAMCs = await (this.amcModel as any).findWithDeleted({ client_id: clientId }).lean();
        for (const amc of clientAMCs) {
          const allPayments = amc.payments || [];
          for (const payment of allPayments) {
            if (payment.status === 'proforma') continue;
            if (payment.status !== 'paid' && payment.invoice_date) {
              const invoiceDate = new Date(payment.invoice_date);
              const daysOverdue = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysOverdue > 60) {
                hasLatePayment = true;
                break;
              }
            }
          }
          if (hasLatePayment) break;
        }
      }

      if (hasLatePayment) {
        riskFactors.push('Late payments >60 days');
      }

      // Check inactivity (no orders/payments in 6+ months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      let hasRecentActivity = false;

      for (const order of clientOrders) {
        if (new Date(order.purchased_date) >= sixMonthsAgo) {
          hasRecentActivity = true;
          break;
        }
      }

      if (!hasRecentActivity) {
        const clientAMCs = await (this.amcModel as any).findWithDeleted({ client_id: clientId }).lean();
        for (const amc of clientAMCs) {
          const allPayments = amc.payments || [];
          for (const payment of allPayments) {
            if (payment.status === 'proforma') continue;
            if (new Date(payment.from_date) >= sixMonthsAgo) {
              hasRecentActivity = true;
              break;
            }
          }
          if (hasRecentActivity) break;
        }
      }

      if (!hasRecentActivity) {
        riskFactors.push('No activity in 6+ months');
      }

      clientRevenueData.push({
        clientId,
        clientName: client.name || 'Unknown',
        industry: client.industry || 'Unknown',
        totalRevenue,
        newSalesRevenue: revenue.newSales,
        amcRevenue: revenue.amc,
        orderCount: revenue.orderCount,
        trend,
        trendPercentage,
        isAtRisk: riskFactors.length > 0,
        riskFactors,
      });
    }

    // Sort by revenue for top performers
    const topClients = [...clientRevenueData]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    // Get at-risk clients
    const atRiskClients = clientRevenueData
      .filter((c) => c.isAtRisk)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      topClients,
      atRiskClients,
    };
  }

  /**
   * Get Client Concentration Risk
   */
  async getClientConcentrationRisk(fiscalYear: number): Promise<IClientConcentrationRisk> {
    const { start, end } = this.getFiscalYearRange(fiscalYear);

    // Get all clients
    const clients = await this.clientModel.find({ deleted: { $ne: true } }).lean();
    const clientMap = new Map(clients.map((c) => [c._id.toString(), c]));

    // Calculate revenue by client
    const clientRevenue = new Map<string, number>();

    // FIX 5: New sales - iterate payment_terms directly instead of calculateNewSaleOrderRevenue
    const orders = await this.orderModel
      .find({
        purchased_date: { $gte: start, $lte: end },
        deleted: { $ne: true },
      })
      .lean();

    for (const order of orders) {
      const clientId = order.client_id?.toString();
      if (!clientId) continue;

      if (this.isNewSaleOrder(order)) {
        for (const term of order.payment_terms || []) {
          if (!term.invoice_date) continue;
          if (term.status === 'proforma') continue;
          if (term.status !== 'paid' && term.status !== 'invoice') continue;

          const revenue = term.calculated_amount || 0;
          clientRevenue.set(clientId, (clientRevenue.get(clientId) || 0) + revenue);
        }
      }
    }

    // AMC
    const amcs = await (this.amcModel as any).findWithDeleted()
      .populate({ path: 'order_id', model: 'Order' })
      .lean();
    for (const amc of amcs) {
      const clientId = amc.client_id?.toString();
      if (!clientId) continue;

      const order = amc.order_id as any;

      const allPayments = amc.payments || [];
      for (const payment of allPayments) {
        if (payment.status === 'proforma') continue;

        const paymentDate = new Date(payment.from_date);
        if (paymentDate >= start && paymentDate <= end) {
          const revenue = payment.amc_rate_amount || 0;
          clientRevenue.set(clientId, (clientRevenue.get(clientId) || 0) + revenue);
        }
      }
    }

    // Calculate total revenue
    const totalRevenue = Array.from(clientRevenue.values()).reduce((sum, r) => sum + r, 0);

    // Sort clients by revenue
    const sortedClients = Array.from(clientRevenue.entries())
      .sort((a, b) => b[1] - a[1]);

    // Top 10 revenue
    const top10ClientsRevenue = sortedClients
      .slice(0, 10)
      .reduce((sum, [, r]) => sum + r, 0);

    const top10Percentage = totalRevenue > 0 ? (top10ClientsRevenue / totalRevenue) * 100 : 0;

    // Calculate Herfindahl-Hirschman Index (HHI)
    let hhi = 0;
    for (const [, revenue] of sortedClients) {
      const marketShare = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
      hhi += marketShare * marketShare;
    }

    // Determine risk level based on HHI
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (hhi > 2500) {
      riskLevel = 'high';
    } else if (hhi > 1500) {
      riskLevel = 'medium';
    }

    // Calculate industry diversification
    const industryRevenue = new Map<string, number>();
    const industryClientCount = new Map<string, number>();

    for (const [clientId, revenue] of clientRevenue) {
      const client = clientMap.get(clientId);
      const industry = client?.industry || 'Unknown';

      industryRevenue.set(industry, (industryRevenue.get(industry) || 0) + revenue);
      industryClientCount.set(industry, (industryClientCount.get(industry) || 0) + 1);
    }

    const industryDiversification: IIndustryBreakdown[] = Array.from(industryRevenue.entries())
      .map(([industry, revenue]) => ({
        industry,
        clientCount: industryClientCount.get(industry) || 0,
        totalRevenue: revenue,
        percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      totalRevenue,
      top10ClientsRevenue,
      top10Percentage,
      herfindahlIndex: hhi,
      riskLevel,
      industryDiversification,
    };
  }

  /**
   * Get Client Health Dashboard (combined)
   */
  async getClientHealthDashboard(fiscalYear: number): Promise<IClientHealthDashboardResponse> {
    const fyLabel = `FY${(fiscalYear % 100).toString().padStart(2, '0')}-${((fiscalYear + 1) % 100).toString().padStart(2, '0')}`;

    const [healthMetrics, topPerformers, concentrationRisk] = await Promise.all([
      this.getClientHealthMetrics(fiscalYear),
      this.getTopPerformers(fiscalYear),
      this.getClientConcentrationRisk(fiscalYear),
    ]);

    return {
      healthMetrics,
      topPerformers,
      concentrationRisk,
      fiscalYear: fyLabel,
    };
  }
}
