import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
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
   * Includes: base_cost + training_and_implementation_cost + licenses + customizations (purchased with order)
   */
  async calculateNewSaleOrderRevenue(order: any): Promise<number> {
    let totalRevenue = 0;

    // Base cost
    totalRevenue += order.base_cost || 0;

    // Training and implementation cost
    totalRevenue += order.training_and_implementation_cost || 0;

    // Licenses purchased with order
    if (order.is_purchased_with_order?.license && order.licenses?.length > 0) {
      const licenses = await this.licenseModel.find({
        _id: { $in: order.licenses },
        deleted: { $ne: true },
      });
      totalRevenue += licenses.reduce((sum, license) => sum + (license.rate?.amount || 0), 0);
    }

    // Customizations purchased with order
    if (order.is_purchased_with_order?.customization && order.customizations?.length > 0) {
      const customizations = await this.customizationModel.find({
        _id: { $in: order.customizations },
        deleted: { $ne: true },
      });
      totalRevenue += customizations.reduce((sum, customization) => sum + (customization.cost || 0), 0);
    }

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

    for (const order of orders) {
      if (this.isNewSaleOrder(order)) {
        const revenue = await this.calculateNewSaleOrderRevenue(order);
        const period = this.getPeriodLabel(new Date(order.purchased_date), filter);
        revenueByPeriod.set(period, (revenueByPeriod.get(period) || 0) + revenue);
      }
    }

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
    const amcs = await this.amcModel
      .find({
        deleted: { $ne: true },
      })
      .populate('order_id')
      .lean();

    const revenueByPeriod = new Map<string, number>();

    for (const amc of amcs) {
      // Skip first payment (index 0) - it's the free maintenance period
      const paidPayments = (amc.payments || []).slice(1);

      for (const payment of paidPayments) {
        const paymentDate = new Date(payment.from_date);

        // Check if payment falls within date range
        if (paymentDate >= startDate && paymentDate <= endDate) {
          // Use amc_rate_amount from payment record
          const revenue = payment.amc_rate_amount || 0;
          const period = this.getPeriodLabel(paymentDate, filter);
          revenueByPeriod.set(period, (revenueByPeriod.get(period) || 0) + revenue);
        }
      }
    }

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
    const { fiscalYear } = query;
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

    for (const order of newSalesOrders) {
      if (this.isNewSaleOrder(order)) {
        const orderExpected = await this.calculateNewSaleOrderRevenue(order);
        const orderCollected = this.calculateCollectedFromPaymentTerms(order.payment_terms || []);

        newSalesExpected += orderExpected;
        newSalesCollected += orderCollected;

        // Add to period breakdown
        const period = this.getPeriodLabel(new Date(order.purchased_date), 'monthly');
        const existing = newSalesByPeriod.get(period) || { expected: 0, collected: 0 };
        existing.expected += orderExpected;
        existing.collected += orderCollected;
        newSalesByPeriod.set(period, existing);
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
    const amcs = await this.amcModel.find({ deleted: { $ne: true } }).lean();

    const amcBreakdown: IPeriodBreakdown[] = [];
    let amcExpected = 0;
    let amcCollected = 0;

    const amcByPeriod = new Map<string, { expected: number; collected: number }>();

    for (const amc of amcs) {
      // Skip first payment (free period) - start from index 1
      const paidPayments = (amc.payments || []).slice(1);

      for (const payment of paidPayments) {
        const paymentDate = new Date(payment.from_date);

        if (paymentDate >= start && paymentDate <= end) {
          // Expected: calculated_amount (amc_rate_amount)
          const expected = payment.amc_rate_amount || 0;
          // Collected: only if status is PAID
          const collected = payment.status === PAYMENT_STATUS_ENUM.PAID ? expected : 0;

          amcExpected += expected;
          amcCollected += collected;

          const period = this.getPeriodLabel(paymentDate, 'monthly');
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
   */
  private calculateCollectedFromPaymentTerms(paymentTerms: any[]): number {
    return paymentTerms
      .filter((term) => term.status === 'paid')
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
        const revenue = await this.calculateNewSaleOrderRevenue(order);
        newSalesTotal += revenue;

        const client = order.client_id as any;
        const products = order.products as any[];

        newSalesDetails.push({
          orderId: order._id.toString(),
          clientName: client?.name || 'Unknown',
          productName: products?.map((p) => p?.name).filter(Boolean).join(', ') || 'N/A',
          amount: revenue,
          status: order.status || 'unknown',
          date: order.purchased_date,
        });
      }
    }

    // AMC Details
    const amcs = await this.amcModel.find({ deleted: { $ne: true } }).populate('client_id').lean();

    const amcDetails: IMonthlyBreakdownDetail[] = [];
    let amcTotal = 0;

    for (const amc of amcs) {
      const paidPayments = (amc.payments || []).slice(1);

      for (const payment of paidPayments) {
        const paymentDate = new Date(payment.from_date);

        if (paymentDate >= start && paymentDate <= end) {
          const revenue = payment.amc_rate_amount || 0;
          amcTotal += revenue;

          const client = amc.client_id as any;

          amcDetails.push({
            orderId: amc.order_id?.toString() || amc._id.toString(),
            clientName: client?.name || 'Unknown',
            productName: 'AMC',
            amount: revenue,
            status: payment.status || 'unknown',
            date: payment.from_date,
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
}
