import {
  Customization,
  CustomizationDocument,
} from '@/db/schema/order/customization.schema';
import { License, LicenseDocument } from '@/db/schema/order/license.schema';
import { Order, OrderDocument } from '@/db/schema/order/product-order.schema';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { Product, ProductDocument } from '@/db/schema/product.schema';
import { LoggerService } from '@/common/logger/services/logger.service';
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
  ReportFilterOptions,
  ReportFilterType,
} from '@/common/types/enums/report';

@Injectable()
export class ReportService {
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
    private readonly loggerService: LoggerService,
  ) {}

  async getProductWiseRevenueDistribution(
    filter: ReportFilterType,
    options?: ReportFilterOptions,
  ) {
    try {
      let start: Date;
      let end: Date;

      // Set date range based on filter type
      switch (filter) {
        case 'monthly':
          end = options?.endDate ? new Date(options.endDate) : new Date();
          start = options?.startDate
            ? new Date(options.startDate)
            : new Date(new Date().setFullYear(end.getFullYear() - 1));
          break;

        case 'yearly':
          // Indian Financial Year: April 1 to March 31
          const fiscalYear = options?.year || new Date().getFullYear();
          start = new Date(fiscalYear, 3, 1); // April 1
          end = new Date(fiscalYear + 1, 2, 31, 23, 59, 59); // March 31 of next year
          break;

        case 'quarterly':
          if (options?.quarter) {
            const [quarter, yearStr] = options.quarter.split(' ');
            const quarterNumber = parseInt(quarter.replace('Q', ''));
            
            // Indian Financial Year quarters (Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar)
            const year = parseInt(yearStr);
            
            const quarterMonths = [
              [3, 4, 5], // Q1: Apr, May, Jun
              [6, 7, 8], // Q2: Jul, Aug, Sep
              [9, 10, 11], // Q3: Oct, Nov, Dec
              [0, 1, 2], // Q4: Jan, Feb, Mar
            ];
            
            const startMonth = quarterMonths[quarterNumber - 1][0];
            const endMonth = quarterMonths[quarterNumber - 1][2];
            
            // For Q4 (Jan-Mar), use the next calendar year
            const startYear = quarterNumber === 4 ? year + 1 : year;
            const endYear = quarterNumber === 4 ? year + 1 : year;
            
            start = new Date(startYear, startMonth, 1);
            end = new Date(endYear, endMonth + 1, 0, 23, 59, 59);
          } else {
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth();
            const currentYear = currentDate.getFullYear();
            
            // Determine current Indian FY quarter
            let quarterStartMonth;
            let quarterEndMonth;
            let quarterStartYear = currentYear;
            let quarterEndYear = currentYear;
            
            if (currentMonth >= 3 && currentMonth <= 5) {
              // Q1: Apr-Jun
              quarterStartMonth = 3;
              quarterEndMonth = 5;
            } else if (currentMonth >= 6 && currentMonth <= 8) {
              // Q2: Jul-Sep
              quarterStartMonth = 6;
              quarterEndMonth = 8;
            } else if (currentMonth >= 9 && currentMonth <= 11) {
              // Q3: Oct-Dec
              quarterStartMonth = 9;
              quarterEndMonth = 11;
            } else {
              // Q4: Jan-Mar (calendar year is one more than fiscal year)
              quarterStartMonth = 0;
              quarterEndMonth = 2;
            }
            
            start = new Date(quarterStartYear, quarterStartMonth, 1);
            end = new Date(quarterEndYear, quarterEndMonth + 1, 0, 23, 59, 59);
          }
          break;

        case 'all':
          start = new Date(0);
          end = new Date();
          break;
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'getProductWiseRevenueDistribution: Using Indian Financial Year',
          data: { 
            filter, 
            start: start.toISOString(), 
            end: end.toISOString(),
            options 
          },
        })
      );

      const dateFilter =
        filter === 'all'
          ? {}
          : {
              purchased_date: {
                $gte: start,
                $lte: end,
              },
            };

      // Fetch orders within the date range
      const orders = await this.orderModel
        .find(dateFilter)
        .populate('products')
        .lean();

      // Prepare a map to hold product revenue
      const productsRevenueMap = new Map<
        string,
        {
          product: Product;
          revenue: number;
          percentage?: number;
          cumulativePercentage?: number;
        }
      >();

      // Process orders to compute revenue per product
      for (const order of orders) {
        if (!order.products || order.products.length === 0) continue;

        // Only count revenue from payment_terms with status 'paid' or 'invoice' (exclude proforma)
        let orderRevenue = 0;
        if (order.payment_terms && order.payment_terms.length > 0) {
          for (const term of order.payment_terms) {
            if (!term.invoice_date) continue;
            if (
              term.status === 'paid' ||
              term.status === 'invoice'
            ) {
              orderRevenue += term.calculated_amount || 0;
            }
          }
        } else {
          orderRevenue = order.base_cost || 0;
        }

        if (orderRevenue === 0) continue;

        const productIds = order.products.map((p: any) => p.toString());
        const productRevenues = new Map<string, number>();

        if (order.products.length === 1) {
          // Single product, assign all revenues to this product
          const productId = productIds[0];
          productRevenues.set(productId, orderRevenue);
        } else {
          // Multiple products
          if (
            order.base_cost_seperation &&
            order.base_cost_seperation.length > 0
          ) {
            // Use base_cost_seperation ratios to distribute revenue
            const totalSep = order.base_cost_seperation.reduce(
              (sum: number, sep: any) => sum + (sep.amount || 0),
              0,
            );
            order.base_cost_seperation.forEach((sep: any) => {
              const productId = sep.product_id.toString();
              const ratio = totalSep > 0 ? (sep.amount || 0) / totalSep : 1 / order.products.length;
              productRevenues.set(productId, ratio * orderRevenue);
            });
          } else {
            // Divide equally among products
            const amountPerProduct = orderRevenue / order.products.length;
            productIds.forEach((productId: string) => {
              productRevenues.set(productId, amountPerProduct);
            });
          }
        }

        // Update productsRevenueMap
        for (const [productId, revenue] of productRevenues.entries()) {
          const existing = productsRevenueMap.get(productId) || {
            product: null,
            revenue: 0,
          };
          existing.revenue += revenue;
          if (!existing.product) {
            const product = await this.productModel.findById(productId).lean();
            existing.product = product as Product;
          }
          productsRevenueMap.set(productId, existing);
        }
      }

      // Process customizations
      const customizations = await this.customizationModel
        .find({
          invoice_date: { $gte: start, $lte: end, $ne: null },
          payment_status: { $in: ['paid', 'invoice'] },
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
          existing.product = product as unknown as Product;
        }
        productsRevenueMap.set(productId, existing);
      }

      // Process licenses
      const licenses = await this.licenseModel
        .find({
          invoice_date: { $gte: start, $lte: end, $ne: null },
          payment_status: { $in: ['paid', 'invoice'] },
        })
        .lean();

      for (const license of licenses) {
        const productId = license.product_id.toString();
        const licenseRevenue =
          (license.rate?.amount || 0) * (license.total_license || 0);
        const existing = productsRevenueMap.get(productId) || {
          product: null,
          revenue: 0,
        };
        existing.revenue += licenseRevenue;
        if (!existing.product) {
          const product = await this.productModel.findById(productId).lean();
          existing.product = product as unknown as Product;
        }
        productsRevenueMap.set(productId, existing);
      }

      // Process additional services
      const additionalServices = await this.additionalServiceModel
        .find({
          invoice_date: { $gte: start, $lte: end, $ne: null },
          payment_status: { $in: ['paid', 'invoice'] },
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
          existing.product = product as unknown as Product;
        }
        productsRevenueMap.set(productId, existing);
      }

      // // Process AMCs
      // const amcs = await this.amcModel.find().lean();

      // for (const amc of amcs) {
      //   // Exclude first payment as it is free maintenance
      //   if (amc.payments.length > 1) {
      //     // Find associated order
      //     const order = await this.orderModel
      //       .findById(amc.order_id)
      //       .populate('products')
      //       .lean();
      //     if (!order || !order.products) continue;

      //     const productIds = order.products.map((p: any) => p.toString());

      //     for (const payment of amc.payments.slice(1)) {
      //       if (
      //         payment.status === PAYMENT_STATUS_ENUM.PAID &&
      //         payment.from_date >= start &&
      //         payment.from_date <= end
      //       ) {
      //         const amcAmount = amc.amount || 0;
      //         const productAmcAmounts = new Map<string, number>();

      //         if (order.products.length === 1) {
      //           const productId = productIds[0];
      //           productAmcAmounts.set(productId, amcAmount);
      //         } else {
      //           if (
      //             order.base_cost_seperation &&
      //             order.base_cost_seperation.length > 0
      //           ) {
      //             const totalPercentage = order.base_cost_seperation.reduce(
      //               (sum: number, sep: any) => sum + (sep.percentage || 0),
      //               0,
      //             );
      //             order.base_cost_seperation.forEach((sep: any) => {
      //               const productId = sep.product_id.toString();
      //               const percentage = sep.percentage || 0;
      //               const amount = (percentage / totalPercentage) * amcAmount;
      //               productAmcAmounts.set(productId, amount);
      //             });
      //           } else {
      //             const amountPerProduct = amcAmount / order.products.length;
      //             productIds.forEach((productId: string) => {
      //               productAmcAmounts.set(productId, amountPerProduct);
      //             });
      //           }
      //         }

      //         // Update productsRevenueMap
      //         for (const [productId, amount] of productAmcAmounts.entries()) {
      //           const existing = productsRevenueMap.get(productId) || {
      //             product: null,
      //             revenue: 0,
      //           };
      //           existing.revenue += amount;
      //           if (!existing.product) {
      //             const product = await this.productModel
      //               .findById(productId)
      //               .lean();
      //             existing.product = product as unknown as Product;
      //           }
      //           productsRevenueMap.set(productId, existing);
      //         }
      //       }
      //     }
      //   }
      // }

      // Prepare data for Pareto chart
      const productsRevenueArray = Array.from(
        productsRevenueMap.values(),
      ).filter((pr) => pr.product);

      // Sort products by revenue ascending
      productsRevenueArray.sort((a, b) => a.revenue - b.revenue);

      // Calculate total revenue
      const totalRevenue = productsRevenueArray.reduce(
        (sum, pr) => sum + pr.revenue,
        0,
      );

      // Calculate cumulative percentages
      let cumulativeRevenue = 0;
      productsRevenueArray.forEach((pr) => {
        pr.percentage = (pr.revenue / totalRevenue) * 100;
        cumulativeRevenue += pr.percentage;
        pr.cumulativePercentage = cumulativeRevenue;
      });

      // Return the data
      return productsRevenueArray.map((pr) => ({
        productId: pr.product._id,
        productName: pr.product.name,
        revenue: pr.revenue,
        percentage: pr.percentage,
        cumulativePercentage: pr.cumulativePercentage,
      }));
    } catch (error) {
      this.loggerService.error(error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getIndustryWiseRevenueDistribution(
    filter: ReportFilterType,
    options?: ReportFilterOptions & {
      month?: number;
      year?: number;
      quarter?: string;
      productId?: string;
    },
  ) {
    try {
      let start: Date;
      let end: Date;

      // Set date range based on filter type
      switch (filter) {
        case 'monthly':
          if (options?.month && options?.year) {
            start = new Date(options.year, options.month - 1, 1);
            end = new Date(options.year, options.month, 0, 23, 59, 59);
          } else {
            const now = new Date();
            const month = now.getMonth();
            const year = now.getFullYear();
            start = new Date(year, month, 1);
            end = new Date(year, month + 1, 0, 23, 59, 59);
          }
          break;

        case 'yearly':
          // Indian Financial Year: April 1 to March 31
          const fiscalYear = options?.year || new Date().getFullYear();
          start = new Date(fiscalYear, 3, 1); // April 1
          end = new Date(fiscalYear + 1, 2, 31, 23, 59, 59); // March 31 of next year
          break;

        case 'quarterly':
          if (options?.quarter) {
            const [qStr, qYearStr] = options.quarter.split(' ');
            const quarterNumber = parseInt(qStr.replace('Q', ''));
            const qYear = parseInt(qYearStr);
            
            // Indian Financial Year quarters (Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar)
            const quarterMonths = [
              [3, 4, 5], // Q1: Apr, May, Jun
              [6, 7, 8], // Q2: Jul, Aug, Sep
              [9, 10, 11], // Q3: Oct, Nov, Dec
              [0, 1, 2], // Q4: Jan, Feb, Mar
            ];
            
            const startMonth = quarterMonths[quarterNumber - 1][0];
            const endMonth = quarterMonths[quarterNumber - 1][2];
            
            // For Q4 (Jan-Mar), we need to use the next calendar year
            const startYear = quarterNumber === 4 ? qYear + 1 : qYear;
            const endYear = quarterNumber === 4 ? qYear + 1 : qYear;
            
            start = new Date(startYear, startMonth, 1);
            end = new Date(endYear, endMonth + 1, 0, 23, 59, 59);
          } else {
            const currentDate = new Date();
            const month = currentDate.getMonth();
            const year = currentDate.getFullYear();
            
            // Determine current Indian FY quarter
            let currentQuarter;
            
            if (month >= 3 && month <= 5) {
              // Q1: Apr-Jun
              currentQuarter = 1;
              start = new Date(year, 3, 1);
              end = new Date(year, 5, 30, 23, 59, 59);
            } else if (month >= 6 && month <= 8) {
              // Q2: Jul-Sep
              currentQuarter = 2;
              start = new Date(year, 6, 1);
              end = new Date(year, 8, 30, 23, 59, 59);
            } else if (month >= 9 && month <= 11) {
              // Q3: Oct-Dec
              currentQuarter = 3;
              start = new Date(year, 9, 1);
              end = new Date(year, 11, 31, 23, 59, 59);
            } else {
              // Q4: Jan-Mar (calendar year is one more than fiscal year)
              currentQuarter = 4;
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
          // Default to current Indian Financial Year
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth();
          
          // If we're before April, we're in the previous FY (e.g., 2023-24)
          // If we're April or later, we're in the current FY (e.g., 2024-25)
          const fiscalYearStart = currentMonth < 3 ? currentYear - 1 : currentYear;
          
          start = new Date(fiscalYearStart, 3, 1); // April 1
          end = new Date(fiscalYearStart + 1, 2, 31, 23, 59, 59); // March 31 of next year
      }
      
      this.loggerService.log(
        JSON.stringify({
          message: 'getIndustryWiseRevenueDistribution: Using Indian Financial Year',
          data: { 
            filter, 
            start: start.toISOString(), 
            end: end.toISOString(),
            options 
          },
        })
      );

      const dateQuery =
        filter === 'all'
          ? {}
          : {
              purchased_date: {
                $gte: start,
                $lte: end,
              },
            };

      // Optional product filter
      let productFilter = {};
      if (options?.productId) {
        productFilter = { products: options.productId };
      }

      // Fetch data with client information
      const [orders, customizations, licenses, additionalServices, amcs] =
        await Promise.all([
          this.orderModel
            .find({ ...dateQuery, ...productFilter })
            .populate('client_id')
            .lean(),
          this.customizationModel
            .find({
              invoice_date:
                filter === 'all' ? { $ne: null } : { $gte: start, $lte: end, $ne: null },
              payment_status: { $in: ['paid', 'invoice'] },
            })
            .populate({
              path: 'order_id',
              match: productFilter,
              populate: { path: 'client_id' },
            })
            .lean(),
          this.licenseModel
            .find({
              invoice_date:
                filter === 'all' ? { $ne: null } : { $gte: start, $lte: end, $ne: null },
              payment_status: { $in: ['paid', 'invoice'] },
            })
            .populate({
              path: 'order_id',
              match: productFilter,
              populate: { path: 'client_id' },
            })
            .lean(),
          this.additionalServiceModel
            .find({
              invoice_date:
                filter === 'all' ? { $ne: null } : { $gte: start, $lte: end, $ne: null },
              payment_status: { $in: ['paid', 'invoice'] },
            })
            .populate({
              path: 'order_id',
              match: productFilter,
              populate: { path: 'client_id' },
            })
            .lean(),
          (this.amcModel as any).findWithDeleted().populate('order_id').lean(),
        ]);

      const groupByPeriod = (date: Date) => {
        switch (filter) {
          case 'monthly':
            return date.toLocaleString('default', {
              year: 'numeric',
              month: 'long',
            });
          case 'quarterly':
            // Indian Financial Year quarter format: Q1 FY23-24 (Apr-Jun 2023)
            const month = date.getMonth();
            const year = date.getFullYear();
            let fiscalYear;
            let quarterNum;
            
            if (month >= 3 && month <= 5) {
              // Q1: Apr-Jun
              quarterNum = 1;
              fiscalYear = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
            } else if (month >= 6 && month <= 8) {
              // Q2: Jul-Sep
              quarterNum = 2;
              fiscalYear = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
            } else if (month >= 9 && month <= 11) {
              // Q3: Oct-Dec
              quarterNum = 3;
              fiscalYear = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
            } else {
              // Q4: Jan-Mar (belongs to previous fiscal year)
              quarterNum = 4;
              fiscalYear = `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
            }
            
            return `Q${quarterNum} FY${fiscalYear}`;
          case 'yearly':
            // Indian Financial Year format: FY23-24 (2023-24)
            const dateYear = date.getFullYear();
            const dateMonth = date.getMonth();
            // If month is January to March, it's part of previous fiscal year
            const fiscalYearStart = dateMonth < 3 ? dateYear - 1 : dateYear;
            return `FY${fiscalYearStart.toString().slice(-2)}-${(fiscalYearStart + 1).toString().slice(-2)}`;
          default:
            return 'All Time';
        }
      };

      // Map to store industry revenue
      const industryRevenueMap = new Map<
        string,
        {
          [period: string]: number;
        }
      >();

      const addRevenue = (industry: string, period: string, amount: number) => {
        if (!industryRevenueMap.has(industry)) {
          industryRevenueMap.set(industry, {});
        }
        const periodRevenue = industryRevenueMap.get(industry);
        if (!periodRevenue[period]) {
          periodRevenue[period] = 0;
        }
        periodRevenue[period] += amount;
      };

      // Process orders
      for (const order of orders) {
        if (!order.client_id) continue;
        const industry =
          (order.client_id as unknown as ClientDocument).industry || 'Unknown';
        for (const term of order.payment_terms || []) {
          if (term.status !== 'paid' && term.status !== 'invoice') continue;
          if (!term.invoice_date) continue;
          const period = groupByPeriod(new Date(term.invoice_date));
          const amount = term.calculated_amount || 0;
          addRevenue(industry, period, amount);
        }
      }

      // Process customizations
      for (const customization of customizations) {
        if (customization.payment_status !== 'paid' && customization.payment_status !== 'invoice') continue;
        if (!customization.invoice_date) continue;
        const period = groupByPeriod(new Date(customization.invoice_date));
        const order = customization.order_id as unknown as OrderDocument;
        if (!order || !order.client_id) continue;
        const industry =
          (order.client_id as unknown as ClientDocument).industry || 'Unknown';
        const amount = customization.cost || 0;
        addRevenue(industry, period, amount);
      }

      // Process licenses
      for (const license of licenses) {
        if (license.payment_status !== 'paid' && license.payment_status !== 'invoice') continue;
        if (!license.invoice_date) continue;
        const period = groupByPeriod(new Date(license.invoice_date));
        const order = license.order_id as unknown as OrderDocument;
        if (!order || !order.client_id) continue;
        const industry =
          (order.client_id as unknown as ClientDocument).industry || 'Unknown';
        const licenseRevenue =
          (license.rate?.amount || 0) * (license.total_license || 0);
        addRevenue(industry, period, licenseRevenue);
      }

      // Process additional services
      for (const service of additionalServices) {
        if (service.payment_status !== 'paid' && service.payment_status !== 'invoice') continue;
        if (!service.invoice_date) continue;
        const period = groupByPeriod(new Date(service.invoice_date));
        const order = service.order_id as unknown as OrderDocument;
        if (!order || !order.client_id) continue;
        const industry =
          (order.client_id as unknown as ClientDocument).industry || 'Unknown';
        const amount = service.cost || 0;
        addRevenue(industry, period, amount);
      }

      // Process AMCs
      for (const amc of amcs) {
        const order = amc.order_id as any;
        const client = await this.clientModel
          .findById(amc.client_id)
          .lean();
        const industry = client?.industry || 'Unknown';
        for (const payment of amc.payments || []) {
          if (payment.status === PAYMENT_STATUS_ENUM.PROFORMA) continue;
          if (
            payment.from_date &&
            new Date(payment.from_date) >= start &&
            new Date(payment.from_date) <= end
          ) {
            const groupDate = order?.amc_start_date ? new Date(order.amc_start_date) : new Date(payment.from_date);
            const period = groupByPeriod(groupDate);
            const amount = payment.amc_rate_amount || 0;
            addRevenue(industry, period, amount);
          }
        }
      }

      // Prepare the final result
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

      // Sort the result
      result.sort((a, b) => {
        if (a.period === b.period) {
          return a.industry.localeCompare(b.industry);
        }
        if (filter === 'monthly') {
          const dateA = new Date(a.period);
          const dateB = new Date(b.period);
          return dateA.getTime() - dateB.getTime();
        } else if (filter === 'quarterly') {
          const [qA, fyA] = a.period.split(' ');
          const [qB, fyB] = b.period.split(' ');
          const diffYear = parseInt(fyA) - parseInt(fyB);
          if (diffYear !== 0) return diffYear;
          return parseInt(qA.replace('Q', '')) - parseInt(qB.replace('Q', ''));
        } else if (filter === 'yearly') {
          // New format: "FY23-24"
          const fyAYears = a.period.substring(2).split('-');
          const fyBYears = b.period.substring(2).split('-');
          
          // Compare by start year
          return parseInt(fyAYears[0]) - parseInt(fyBYears[0]);
        }
        return 0;
      });

      return result;
    } catch (error) {
      this.loggerService.error(error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private calculateDateRange(
    filter: ReportFilterType,
    options?: ReportFilterOptions & {
      month?: number;
      year?: number;
      quarter?: string;
    },
  ): [Date, Date] {
    let start: Date;
    let end: Date;

    switch (filter) {
      case 'monthly':
        if (options?.month && options?.year) {
          start = new Date(options.year, options.month - 1, 1);
          end = new Date(options.year, options.month, 0, 23, 59, 59);
        } else {
          const now = new Date();
          const month = now.getMonth();
          const year = now.getFullYear();
          start = new Date(year, month, 1);
          end = new Date(year, month + 1, 0, 23, 59, 59);
        }
        break;
      case 'yearly':
        // Indian Financial Year: April 1 to March 31
        const fiscalYear = options?.year || new Date().getFullYear();
        start = new Date(fiscalYear, 3, 1); // April 1
        end = new Date(fiscalYear + 1, 2, 31, 23, 59, 59); // March 31 of next year
        break;
      case 'quarterly':
        if (options?.quarter) {
          const [qStr, qYearStr] = options.quarter.split(' ');
          const quarterNumber = parseInt(qStr.replace('Q', ''));
          const qYear = parseInt(qYearStr);
          
          // Indian Financial Year quarters (Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar)
          const quarterMonths = [
            [3, 4, 5], // Q1: Apr, May, Jun
            [6, 7, 8], // Q2: Jul, Aug, Sep
            [9, 10, 11], // Q3: Oct, Nov, Dec
            [0, 1, 2], // Q4: Jan, Feb, Mar
          ];
          
          const startMonth = quarterMonths[quarterNumber - 1][0];
          const endMonth = quarterMonths[quarterNumber - 1][2];
          
          // For Q4 (Jan-Mar), we need to use the next calendar year
          const startYear = quarterNumber === 4 ? qYear + 1 : qYear;
          const endYear = quarterNumber === 4 ? qYear + 1 : qYear;
          
          start = new Date(startYear, startMonth, 1);
          end = new Date(endYear, endMonth + 1, 0, 23, 59, 59);
        } else {
          const currentDate = new Date();
          const month = currentDate.getMonth();
          const year = currentDate.getFullYear();
          
          // Determine current Indian FY quarter
          let currentQuarter;
          let startYear = year;
          let endYear = year;
          
          if (month >= 3 && month <= 5) {
            // Q1: Apr-Jun
            currentQuarter = 1;
            start = new Date(year, 3, 1);
            end = new Date(year, 5, 30, 23, 59, 59);
          } else if (month >= 6 && month <= 8) {
            // Q2: Jul-Sep
            currentQuarter = 2;
            start = new Date(year, 6, 1);
            end = new Date(year, 8, 30, 23, 59, 59);
          } else if (month >= 9 && month <= 11) {
            // Q3: Oct-Dec
            currentQuarter = 3;
            start = new Date(year, 9, 1);
            end = new Date(year, 11, 31, 23, 59, 59);
          } else {
            // Q4: Jan-Mar (the calendar year is one more than fiscal year)
            currentQuarter = 4;
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
        // Default to current Indian Financial Year
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        
        // If we're before April, we're in the previous FY (e.g., 2023-24)
        // If we're April or later, we're in the current FY (e.g., 2024-25)
        const fiscalYearStart = currentMonth < 3 ? currentYear - 1 : currentYear;
        
        start = new Date(fiscalYearStart, 3, 1); // April 1
        end = new Date(fiscalYearStart + 1, 2, 31, 23, 59, 59); // March 31 of next year
    }

    this.loggerService.log(
      JSON.stringify({
        message: 'calculateDateRange: Using Indian Financial Year',
        data: { 
          filter, 
          start: start.toISOString(), 
          end: end.toISOString(),
          options 
        },
      })
    );

    return [start, end];
  }

  async getTotalBussinessRevenue(
    filter: ReportFilterType,
    options?: ReportFilterOptions & {
      month?: number;
      year?: number;
      quarter?: string;
    },
  ) {
    const [start, end] = this.calculateDateRange(filter, options);

    const groupByPeriod = (date: Date) => {
      const dateObj = new Date(date);
      switch (filter) {
        case 'monthly':
          return dateObj.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
          });
        case 'quarterly':
          // Indian Financial Year quarter format: Q1 FY23-24 (Apr-Jun 2023)
          const month = dateObj.getMonth();
          const year = dateObj.getFullYear();
          let fiscalYear;
          let quarterNum;
          
          if (month >= 3 && month <= 5) {
            // Q1: Apr-Jun
            quarterNum = 1;
            fiscalYear = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
          } else if (month >= 6 && month <= 8) {
            // Q2: Jul-Sep
            quarterNum = 2;
            fiscalYear = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
          } else if (month >= 9 && month <= 11) {
            // Q3: Oct-Dec
            quarterNum = 3;
            fiscalYear = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
          } else {
            // Q4: Jan-Mar (belongs to previous fiscal year)
            quarterNum = 4;
            fiscalYear = `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
          }
          
          return `Q${quarterNum} FY${fiscalYear}`;
        case 'yearly':
          // Indian Financial Year format: FY23-24 (2023-24)
          const dateYear = dateObj.getFullYear();
          const dateMonth = dateObj.getMonth();
          // If month is January to March, it's part of previous fiscal year
          const fiscalYearStart = dateMonth < 3 ? dateYear - 1 : dateYear;
          return `FY${fiscalYearStart.toString().slice(-2)}-${(fiscalYearStart + 1).toString().slice(-2)}`;
        default:
          return 'All Time';
      }
    };

    const billingMap = new Map<
      string,
      {
        totalPurchaseBilling: number;
        totalAMCBilling: number;
      }
    >();

    const addBilling = (
      date: Date,
      billing: { purchase?: number; amc?: number },
    ) => {
      if (date < start || date > end) return;
      const period = groupByPeriod(date);
      if (!billingMap.has(period)) {
        billingMap.set(period, {
          totalPurchaseBilling: 0,
          totalAMCBilling: 0,
        });
      }
      const entry = billingMap.get(period);
      if (billing.purchase) {
        entry.totalPurchaseBilling += billing.purchase;
      }
      if (billing.amc) {
        entry.totalAMCBilling += billing.amc;
      }
      billingMap.set(period, entry);
    };

    const orders = await this.orderModel.find({
      payment_terms: { $exists: true },
    });
    for (const order of orders) {
      for (const term of order.payment_terms || []) {
        if (term.status !== 'paid' && term.status !== 'invoice') continue;
        if (!term.invoice_date) continue;
        addBilling(new Date(term.invoice_date), {
          purchase: term.calculated_amount || 0,
        });
      }
    }

    const customizations = await this.customizationModel.find();
    for (const item of customizations) {
      if (item.payment_status !== 'paid' && item.payment_status !== 'invoice') continue;
      if (!item.invoice_date) continue;
      addBilling(new Date(item.invoice_date), { purchase: item.cost || 0 });
    }

    const licenses = await this.licenseModel.find();
    for (const lic of licenses) {
      if (lic.payment_status !== 'paid' && lic.payment_status !== 'invoice') continue;
      if (!lic.invoice_date) continue;
      const licenseBilling = (lic.rate?.amount || 0) * (lic.total_license || 0);
      addBilling(new Date(lic.invoice_date), { purchase: licenseBilling });
    }

    const services = await this.additionalServiceModel.find();
    for (const service of services) {
      if (service.payment_status !== 'paid' && service.payment_status !== 'invoice') continue;
      if (!service.invoice_date) continue;
      addBilling(new Date(service.invoice_date), { purchase: service.cost || 0 });
    }

    const amcs = await (this.amcModel as any).findWithDeleted().populate('order_id').lean();
    for (const amc of amcs) {
      const order = amc.order_id as any;
      for (const payment of amc.payments || []) {
        if (payment.status === PAYMENT_STATUS_ENUM.PROFORMA) continue;
        // Range check using payment.from_date
        if (!payment.from_date) continue;
        const paymentFromDate = new Date(payment.from_date);
        if (paymentFromDate < start || paymentFromDate > end) continue;
        // Group by order.amc_start_date when available, fallback to payment.from_date
        const groupDate = order?.amc_start_date ? new Date(order.amc_start_date) : paymentFromDate;
        addBilling(groupDate, {
          amc: payment.amc_rate_amount || 0,
        });
      }
    }

    const resultArray = Array.from(billingMap.entries()).map(
      ([period, data]) => ({
        period,
        total_amc_billing: data.totalAMCBilling,
        total_purchase_billing: data.totalPurchaseBilling,
      }),
    );

    const sortByPeriod = (a: string, b: string) => {
      if (filter === 'monthly') {
        return new Date(a).getTime() - new Date(b).getTime();
      } else if (filter === 'quarterly') {
        const [qA, fyA] = a.split(' ');
        const [qB, fyB] = b.split(' ');
        
        // Extract fiscal years (e.g., "23-24" from "FY23-24")
        const fyAYears = fyA.substring(2).split('-');
        const fyBYears = fyB.substring(2).split('-');
        
        // Compare first year
        const yearDiff = parseInt(fyAYears[0]) - parseInt(fyBYears[0]);
        if (yearDiff !== 0) return yearDiff;
        
        // If same fiscal year, compare quarter
        return parseInt(qA.replace('Q', '')) - parseInt(qB.replace('Q', ''));
      } else if (filter === 'yearly') {
        // New format: "FY23-24"
        const fyAYears = a.substring(2).split('-');
        const fyBYears = b.substring(2).split('-');
        
        // Compare by start year
        return parseInt(fyAYears[0]) - parseInt(fyBYears[0]);
      }
      return 0;
    };

    return resultArray
      .filter((d) => d.period !== 'Invalid Date')
      .sort((a, b) => sortByPeriod(a.period, b.period));
  }

  async getAMCAnnualBreakdown(
    filter: ReportFilterType,
    options?: ReportFilterOptions & { productId?: string },
  ) {
    try {
      let start: Date;
      let end: Date;

      // Set date range based on filter type
      switch (filter) {
        case 'monthly':
          end = options?.endDate ? new Date(options.endDate) : new Date();
          start = options?.startDate
            ? new Date(options.startDate)
            : new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());
          break;

        case 'yearly':
          // Indian Financial Year: April 1 to March 31
          const fiscalYear = options?.year || new Date().getFullYear();
          start = new Date(fiscalYear, 3, 1); // April 1
          end = new Date(fiscalYear + 1, 2, 31, 23, 59, 59); // March 31 of next year
          break;

        case 'quarterly':
          if (options?.quarter) {
            const [qStr, qYearStr] = options.quarter.split(' ');
            const qNum = parseInt(qStr.replace('Q', ''));
            const qYear = parseInt(qYearStr);
            
            // Indian Financial Year quarters (Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar)
            const quarterMonths = [
              [3, 4, 5], // Q1: Apr, May, Jun
              [6, 7, 8], // Q2: Jul, Aug, Sep
              [9, 10, 11], // Q3: Oct, Nov, Dec
              [0, 1, 2], // Q4: Jan, Feb, Mar
            ];
            
            const startMonth = quarterMonths[qNum - 1][0];
            const endMonth = quarterMonths[qNum - 1][2];
            
            // For Q4 (Jan-Mar), we need to use the next calendar year
            const startYear = qNum === 4 ? qYear + 1 : qYear;
            const endYear = qNum === 4 ? qYear + 1 : qYear;
            
            start = new Date(startYear, startMonth, 1);
            end = new Date(endYear, endMonth + 1, 0, 23, 59, 59);
          } else {
            const currentDate = new Date();
            const month = currentDate.getMonth();
            const year = currentDate.getFullYear();
            
            // Determine current Indian FY quarter
            let currentQuarter;
            
            if (month >= 3 && month <= 5) {
              // Q1: Apr-Jun
              currentQuarter = 1;
              start = new Date(year, 3, 1);
              end = new Date(year, 5, 30, 23, 59, 59);
            } else if (month >= 6 && month <= 8) {
              // Q2: Jul-Sep
              currentQuarter = 2;
              start = new Date(year, 6, 1);
              end = new Date(year, 8, 30, 23, 59, 59);
            } else if (month >= 9 && month <= 11) {
              // Q3: Oct-Dec
              currentQuarter = 3;
              start = new Date(year, 9, 1);
              end = new Date(year, 11, 31, 23, 59, 59);
            } else {
              // Q4: Jan-Mar (calendar year is one more than fiscal year)
              currentQuarter = 4;
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
          // Default to current Indian Financial Year
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth();
          
          // If we're before April, we're in the previous FY (e.g., 2023-24)
          // If we're April or later, we're in the current FY (e.g., 2024-25)
          const fiscalYearStart = currentMonth < 3 ? currentYear - 1 : currentYear;
          
          start = new Date(fiscalYearStart, 3, 1); // April 1
          end = new Date(fiscalYearStart + 1, 2, 31, 23, 59, 59); // March 31 of next year
      }
      
      this.loggerService.log(
        JSON.stringify({
          message: 'getAMCAnnualBreakdown: Using Indian Financial Year',
          data: { 
            filter, 
            start: start.toISOString(), 
            end: end.toISOString(),
            options 
          },
        })
      );

      const groupByPeriod = (date: Date) => {
        switch (filter) {
          case 'monthly':
            return date.toLocaleString('default', {
              year: 'numeric',
              month: 'long',
            });
          case 'quarterly':
            // Indian Financial Year quarter format: Q1 FY23-24 (Apr-Jun 2023)
            const month = date.getMonth();
            const year = date.getFullYear();
            let fiscalYear;
            let quarterNum;
            
            if (month >= 3 && month <= 5) {
              // Q1: Apr-Jun
              quarterNum = 1;
              fiscalYear = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
            } else if (month >= 6 && month <= 8) {
              // Q2: Jul-Sep
              quarterNum = 2;
              fiscalYear = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
            } else if (month >= 9 && month <= 11) {
              // Q3: Oct-Dec
              quarterNum = 3;
              fiscalYear = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
            } else {
              // Q4: Jan-Mar (belongs to previous fiscal year)
              quarterNum = 4;
              fiscalYear = `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
            }
            
            return `Q${quarterNum} FY${fiscalYear}`;
          case 'yearly':
            // Indian Financial Year format: FY23-24 (2023-24)
            const dateYear = date.getFullYear();
            const dateMonth = date.getMonth();
            // If month is January to March, it's part of previous fiscal year
            const fiscalYearStart = dateMonth < 3 ? dateYear - 1 : dateYear;
            return `FY${fiscalYearStart.toString().slice(-2)}-${(fiscalYearStart + 1).toString().slice(-2)}`;
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

      const amcs = await (this.amcModel as any).findWithDeleted(amcQuery).populate('order_id').lean();

      const breakdownMap = new Map<
        string,
        {
          totalExpected: number;
          totalCollected: number;
        }
      >();

      for (const amc of amcs) {
        const order = amc.order_id as any;

        for (const payment of amc.payments || []) {
          if (payment.status === PAYMENT_STATUS_ENUM.PROFORMA) continue;
          // Range check using payment.from_date
          if (!payment.from_date) continue;
          const paymentDate = new Date(payment.from_date);
          if (paymentDate >= start && paymentDate <= end) {
            // Group by order.amc_start_date when available, fallback to payment.from_date
            const groupDate = order?.amc_start_date ? new Date(order.amc_start_date) : paymentDate;
            const period = groupByPeriod(groupDate);
            const existing = breakdownMap.get(period) || {
              totalExpected: 0,
              totalCollected: 0,
            };
            existing.totalExpected += payment.amc_rate_amount || 0;
            if (payment.status === PAYMENT_STATUS_ENUM.PAID) {
              existing.totalCollected += payment.amc_rate_amount || 0;
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
          if (filter === 'all') return 0;
          if (filter === 'monthly') {
            const dateA = new Date(a.period);
            const dateB = new Date(b.period);
            return dateA.getTime() - dateB.getTime();
          } else if (filter === 'yearly') {
            // New format: "FY23-24"
            const fyAYears = a.period.substring(2).split('-');
            const fyBYears = b.period.substring(2).split('-');
            
            // Compare by start year
            return parseInt(fyAYears[0]) - parseInt(fyBYears[0]);
          } else if (filter === 'quarterly') {
            // New format: "Q1 FY23-24"
            const [qA, fyA] = a.period.split(' ');
            const [qB, fyB] = b.period.split(' ');
            
            // Extract fiscal years (e.g., "23-24" from "FY23-24")
            const fyAYears = fyA.substring(2).split('-');
            const fyBYears = fyB.substring(2).split('-');
            
            // Compare first year
            const yearDiff = parseInt(fyAYears[0]) - parseInt(fyBYears[0]);
            if (yearDiff !== 0) return yearDiff;
            
            // If same fiscal year, compare quarter
            return parseInt(qA.replace('Q', '')) - parseInt(qB.replace('Q', ''));
          }
          return 0;
        });

      return result;
    } catch (error) {
      this.loggerService.error(error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getExpectedVsReceivedChartData(
    filter: ReportFilterType,
    options?: ReportFilterOptions & {
      month?: number;
      year?: number;
      quarter?: string;
    },
  ) {
    const [start, end] = this.calculateDateRange(filter, options);

    // Helper to categorize a date into the requested period label
    const groupByPeriod = (dateValue: Date) => {
      const temp = new Date(dateValue);
      switch (filter) {
        case 'monthly':
          return temp.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
          });
        case 'quarterly':
          // Indian Financial Year quarter format: Q1 FY23-24 (Apr-Jun 2023)
          const month = temp.getMonth();
          const year = temp.getFullYear();
          let fiscalYear;
          let quarterNum;
          
          if (month >= 3 && month <= 5) {
            // Q1: Apr-Jun
            quarterNum = 1;
            fiscalYear = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
          } else if (month >= 6 && month <= 8) {
            // Q2: Jul-Sep
            quarterNum = 2;
            fiscalYear = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
          } else if (month >= 9 && month <= 11) {
            // Q3: Oct-Dec
            quarterNum = 3;
            fiscalYear = `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
          } else {
            // Q4: Jan-Mar (belongs to previous fiscal year)
            quarterNum = 4;
            fiscalYear = `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
          }
          
          return `Q${quarterNum} FY${fiscalYear}`;
        case 'yearly':
          // Indian Financial Year format: FY23-24 (2023-24)
          const dateYear = temp.getFullYear();
          const dateMonth = temp.getMonth();
          // If month is January to March, it's part of previous fiscal year
          const fiscalYearStart = dateMonth < 3 ? dateYear - 1 : dateYear;
          return `FY${fiscalYearStart.toString().slice(-2)}-${(fiscalYearStart + 1).toString().slice(-2)}`;
        default:
          return 'All Time';
      }
    };

    // Map to accumulate expected vs. received
    const dataMap = new Map<string, { expected: number; received: number }>();

    // Minimal helper to track data
    const addData = (dt: Date, expectedVal: number, receivedVal: number) => {
      if (dt < start || dt > end) return;
      const label = groupByPeriod(dt);
      const entry = dataMap.get(label) || { expected: 0, received: 0 };
      entry.expected += expectedVal;
      entry.received += receivedVal;
      dataMap.set(label, entry);
    };

    // 1) Orders
    const allOrders = await this.orderModel.find({
      payment_terms: { $exists: true },
    });
    for (const ord of allOrders) {
      for (const t of ord.payment_terms || []) {
        if (t.status !== 'paid' && t.status !== 'invoice') continue;
        if (!t.invoice_date) continue;
        // Expected on term.invoice_date
        addData(new Date(t.invoice_date), t.calculated_amount || 0, 0);
        // Received if status is paid
        if (t.status === 'paid') {
          addData(new Date(t.invoice_date), 0, t.calculated_amount || 0);
        }
      }
    }

    // 2) Customizations
    const allCustom = await this.customizationModel.find();
    for (const c of allCustom) {
      if (c.payment_status !== 'paid' && c.payment_status !== 'invoice') continue;
      if (!c.invoice_date) continue;
      // Expected on invoice_date
      addData(new Date(c.invoice_date), c.cost || 0, 0);
      // Received if paid
      if (c.payment_status === 'paid') {
        addData(new Date(c.invoice_date), 0, c.cost || 0);
      }
    }

    // 3) Licenses
    const allLicenses = await this.licenseModel.find();
    for (const l of allLicenses) {
      if (l.payment_status !== 'paid' && l.payment_status !== 'invoice') continue;
      if (!l.invoice_date) continue;
      const cost = (l.rate?.amount || 0) * (l.total_license || 0);
      // Expected on invoice_date
      addData(new Date(l.invoice_date), cost, 0);
      // Received if paid
      if (l.payment_status === 'paid') {
        addData(new Date(l.invoice_date), 0, cost);
      }
    }

    // 4) Additional Services
    const allServices = await this.additionalServiceModel.find();
    for (const s of allServices) {
      if (s.payment_status !== 'paid' && s.payment_status !== 'invoice') continue;
      if (!s.invoice_date) continue;
      // Expected on invoice_date
      addData(new Date(s.invoice_date), s.cost || 0, 0);
      // Received if paid
      if (s.payment_status === 'paid') {
        addData(new Date(s.invoice_date), 0, s.cost || 0);
      }
    }

    // 5) AMCs
    const allAmcs = await (this.amcModel as any).findWithDeleted().populate('order_id').lean();
    for (const a of allAmcs) {
      const amcOrder = a.order_id as any;
      for (const pay of a.payments || []) {
        if (pay.status === PAYMENT_STATUS_ENUM.PROFORMA) continue;
        // Range check using pay.from_date
        if (!pay.from_date) continue;
        const fromDate = new Date(pay.from_date);
        if (fromDate < start || fromDate > end) continue;
        // Expected amount grouped by order.amc_start_date when available, fallback to pay.from_date
        const groupDate = amcOrder?.amc_start_date ? new Date(amcOrder.amc_start_date) : fromDate;
        const expectedAmount = pay.amc_rate_amount || 0;
        addData(groupDate, expectedAmount, 0);

        // If paid, add to received
        if (pay.status === PAYMENT_STATUS_ENUM.PAID) {
          addData(groupDate, 0, expectedAmount);
        }
      }
    }

    // Convert map to an array
    const output = Array.from(dataMap.entries()).map(
      ([period, { expected, received }]) => {
        return { period, expected_amount: expected, received_amount: received };
      },
    );

    // Sorting function matching the period style
    const sorter = (a: string, b: string) => {
      if (filter === 'monthly') {
        return new Date(a).getTime() - new Date(b).getTime();
      }
      if (filter === 'quarterly') {
        const [qA, fyA] = a.split(' ');
        const [qB, fyB] = b.split(' ');
        
        // Extract fiscal years (e.g., "23-24" from "FY23-24")
        const fyAYears = fyA.substring(2).split('-');
        const fyBYears = fyB.substring(2).split('-');
        
        // Compare first year
        const yearDiff = parseInt(fyAYears[0]) - parseInt(fyBYears[0]);
        if (yearDiff !== 0) return yearDiff;
        
        // If same fiscal year, compare quarter
        return parseInt(qA.replace('Q', '')) - parseInt(qB.replace('Q', ''));
      }
      if (filter === 'yearly') {
        // New format: "FY23-24"
        const fyAYears = a.substring(2).split('-');
        const fyBYears = b.substring(2).split('-');
        
        // Compare by start year
        return parseInt(fyAYears[0]) - parseInt(fyBYears[0]);
      }
      return 0;
    };

    // Return sorted result
    return output.sort((x, y) => sorter(x.period, y.period));
  }

  async fetchIndustryRevenueDistribution(
    filter: ReportFilterType,
    options?: ReportFilterOptions & {
      month?: number;
      year?: number;
      quarter?: string;
    },
  ) {
    const [start, end] = this.calculateDateRange(filter, options);

    const groupByPeriod = (date: Date) => {
      switch (filter) {
        case 'monthly':
          return date.toLocaleString('default', {
            year: 'numeric',
            month: 'long',
          });
        case 'quarterly':
          // Use our helper method to get the Indian Financial Year quarter format
          const { quarterName } = this.getFinancialYearInfo(date);
          return quarterName;
        case 'yearly':
          // Use our helper method to get the Indian Financial Year format
          const { fiscalYear } = this.getFinancialYearInfo(date);
          return `FY${fiscalYear}`;
        default:
          return 'All Time';
      }
    };

    // Data structure:  Map< period, Map< industry, { totalExpected, totalReceived, productBreakdown } > >
    // productBreakdown: Map< productName, { expected, received } >
    const chartMap = new Map<
      string,
      Map<
        string,
        {
          totalExpected: number;
          totalReceived: number;
          productBreakdown: Map<string, { expected: number; received: number }>;
        }
      >
    >();

    const addData = (
      date: Date,
      industry: string,
      productName: string,
      expected: number,
      received: number,
    ) => {
      if (date < start || date > end) return;
      const period = groupByPeriod(date);
      if (!chartMap.has(period)) {
        chartMap.set(period, new Map());
      }
      const industryLevel = chartMap.get(period);
      if (!industryLevel.has(industry)) {
        industryLevel.set(industry, {
          totalExpected: 0,
          totalReceived: 0,
          productBreakdown: new Map(),
        });
      }
      const industryData = industryLevel.get(industry);

      // Update totals
      industryData.totalExpected += expected;
      industryData.totalReceived += received;

      // Update product breakdown
      if (!industryData.productBreakdown.has(productName)) {
        industryData.productBreakdown.set(productName, {
          expected: 0,
          received: 0,
        });
      }
      const productData = industryData.productBreakdown.get(productName);
      productData.expected += expected;
      productData.received += received;

      industryLevel.set(industry, industryData);
      chartMap.set(period, industryLevel);
    };

    // 1) Orders
    const orders = await this.orderModel
      .find({ payment_terms: { $exists: true } })
      .populate([
        {
          path: 'products',
          model: 'Product',
        },
        {
          path: 'client_id',
          model: 'Client',
        },
      ]);
    for (const order of orders) {
      const client = order.client_id as unknown as ClientDocument;
      const ind = (client?.industry as string) || 'Unknown';
      const prods = Array.isArray(order.products)
        ? (order.products as any[])
        : [];
      for (const term of order.payment_terms || []) {
        if (term.status !== 'paid' && term.status !== 'invoice') continue;
        if (!term.invoice_date) continue;
        // Expected on term.invoice_date
        for (const p of prods) {
          addData(
            new Date(term.invoice_date),
            ind,
            p.name,
            term.calculated_amount || 0,
            0,
          );
        }
        // Received if status is paid
        if (term.status === 'paid') {
          for (const p of prods) {
            addData(
              new Date(term.invoice_date),
              ind,
              p.name,
              0,
              term.calculated_amount || 0,
            );
          }
        }
      }
    }

    // 2) Customizations
    const customizations = await this.customizationModel.find().populate({
      path: 'order_id',
      populate: [
        {
          path: 'client_id',
          model: 'Client',
        },
        {
          path: 'products',
          model: 'Product',
        },
      ],
    });
    for (const c of customizations) {
      if (c.payment_status !== 'paid' && c.payment_status !== 'invoice') continue;
      if (!c.invoice_date) continue;
      const order = c.order_id as any;
      if (!order) continue;
      const ind = (order.client_id?.industry as string) || 'Unknown';
      const prods = Array.isArray(order.products) ? order.products : [];
      // Expected on invoice_date
      for (const p of prods) {
        addData(new Date(c.invoice_date), ind, p.name, c.cost || 0, 0);
      }
      // Received if paid
      if (c.payment_status === 'paid') {
        for (const p of prods) {
          addData(new Date(c.invoice_date), ind, p.name, 0, c.cost || 0);
        }
      }
    }

    // 3) Licenses
    const licenses = await this.licenseModel.find().populate({
      path: 'order_id',
      populate: [
        {
          path: 'client_id',
          model: 'Client',
        },
        {
          path: 'products',
          model: 'Product',
        },
      ],
    });
    for (const lic of licenses) {
      if (lic.payment_status !== 'paid' && lic.payment_status !== 'invoice') continue;
      if (!lic.invoice_date) continue;
      const order = lic.order_id as any;
      if (!order) continue;
      const ind = (order.client_id?.industry as string) || 'Unknown';
      const prods = Array.isArray(order.products) ? order.products : [];
      const cost = (lic.rate?.amount || 0) * (lic.total_license || 0);
      // Expected on invoice_date
      for (const p of prods) {
        addData(new Date(lic.invoice_date), ind, p.name, cost, 0);
      }
      // Received if paid
      if (lic.payment_status === 'paid') {
        for (const p of prods) {
          addData(new Date(lic.invoice_date), ind, p.name, 0, cost);
        }
      }
    }

    // 4) Additional Services
    const services = await this.additionalServiceModel.find().populate({
      path: 'order_id',
      populate: [
        {
          path: 'client_id',
          model: 'Client',
        },
        {
          path: 'products',
          model: 'Product',
        },
      ],
    });
    for (const s of services) {
      if (s.payment_status !== 'paid' && s.payment_status !== 'invoice') continue;
      if (!s.invoice_date) continue;
      const order = s.order_id as any;
      if (!order) continue;
      const ind = (order.client_id?.industry as string) || 'Unknown';
      const prods = Array.isArray(order.products) ? order.products : [];
      // Expected on invoice_date
      for (const p of prods) {
        addData(new Date(s.invoice_date), ind, p.name, s.cost || 0, 0);
      }
      // Received if paid
      if (s.payment_status === 'paid') {
        for (const p of prods) {
          addData(new Date(s.invoice_date), ind, p.name, 0, s.cost || 0);
        }
      }
    }

    // 5) AMCs
    const amcs = await this.amcModel
      .find()
      .populate('client_id')
      .populate({
        path: 'order_id',
        populate: { path: 'products', model: 'Product' },
      });
    for (const a of amcs) {
      const ind = (a.client_id as any)?.industry || 'Unknown';
      const order = a.order_id as any;
      if (!order || !order.products) continue;
      const prods = Array.isArray(order.products) ? order.products : [];
      for (const pay of a.payments || []) {
        if (pay.status === PAYMENT_STATUS_ENUM.PROFORMA) continue;
        // Range check using pay.from_date
        if (!pay.from_date) continue;
        const fromDate = new Date(pay.from_date);
        if (fromDate < start || fromDate > end) continue;
        // Group by order.amc_start_date when available, fallback to pay.from_date
        const groupDate = order.amc_start_date ? new Date(order.amc_start_date) : fromDate;
        for (const p of prods) {
          addData(groupDate, ind, p.name, pay.amc_rate_amount || 0, 0);
        }
        if (pay.status === PAYMENT_STATUS_ENUM.PAID) {
          for (const p of prods) {
            addData(groupDate, ind, p.name, 0, pay.amc_rate_amount || 0);
          }
        }
      }
    }

    // Convert the map into array format
    const output = [];
    for (const [period, industryMap] of chartMap) {
      for (const [industry, info] of industryMap) {
        // Flatten product breakdown
        const resultRow: any = {
          period,
          industry,
          // total_expected: info.totalExpected,
          total: info.totalReceived,
        };
        for (const [prodName, amounts] of info.productBreakdown.entries()) {
          // resultRow[`${prodName}`] = amounts.expected;
          resultRow[`${prodName}`] = amounts.received;
        }
        output.push(resultRow);
      }
    }

    // Sort by period
    const sortEntries = (a: string, b: string): number => {
      if (filter === 'monthly') {
        return new Date(a).getTime() - new Date(b).getTime();
      } else if (filter === 'quarterly') {
        const [qA, fyA] = a.split(' ');
        const [qB, fyB] = b.split(' ');
        
        // Extract fiscal years (e.g., "23-24" from "FY23-24")
        const fyAYears = fyA.substring(2).split('-');
        const fyBYears = fyB.substring(2).split('-');
        
        // Compare first year
        const yearDiff = parseInt(fyAYears[0]) - parseInt(fyBYears[0]);
        if (yearDiff !== 0) return yearDiff;
        
        // If same fiscal year, compare quarter
        return parseInt(qA.replace('Q', '')) - parseInt(qB.replace('Q', ''));
      } else if (filter === 'yearly') {
        // New format: "FY23-24"
        const fyAYears = a.substring(2).split('-');
        const fyBYears = b.substring(2).split('-');
        
        // Compare by start year
        return parseInt(fyAYears[0]) - parseInt(fyBYears[0]);
      }
      return 0;
    };

    return output.sort((x, y) => sortEntries(x.period, y.period));
  }

  // async getPieChartSalesData(
  //   filter: ReportFilterType,
  //   options?: ReportFilterOptions & {
  //     month?: number;
  //     year?: number;
  //     quarter?: string;
  //   },
  // ) {}

  /**
   * Parse a FY string like "FY2025-2026" into a date range (Apr 1 - Mar 31).
   */
  private fyStringToDateRange(fy: string): { startDate: Date; endDate: Date } {
    const match = fy.match(/^FY(\d{4})-(\d{4})$/);
    if (!match) throw new Error(`Invalid FY string: ${fy}`);
    const startYear = parseInt(match[1], 10);
    const endYear = parseInt(match[2], 10);
    const startDate = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999));
    return { startDate, endDate };
  }

  /**
   * Get pending-payment breakdown for a given Indian Financial Year,
   * bucketed by Monthly / Quarterly / Half-Yearly / Yearly granularity.
   */
  async getPendingBreakdownByPeriod(args: {
    fy: string;
    granularity: 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';
  }): Promise<{
    fy: string;
    granularity: string;
    buckets: Array<{ label: string; pending_amount: number; count: number }>;
    totals: { pending_amount: number; count: number };
  }> {
    const { fy, granularity } = args;
    const { startDate, endDate } = this.fyStringToDateRange(fy);

    // Pre-initialize buckets based on granularity
    const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const startYear = startDate.getUTCFullYear();
    const endYear = endDate.getUTCFullYear();

    let labels: string[] = [];
    switch (granularity) {
      case 'monthly': {
        for (let i = 0; i < 12; i++) {
          const yr = i < 9 ? startYear : endYear;
          labels.push(`${monthNames[i]} ${yr}`);
        }
        break;
      }
      case 'quarterly': {
        const fyShort = `FY${startYear}-${endYear.toString().slice(-2)}`;
        labels = [`Q1 ${fyShort}`, `Q2 ${fyShort}`, `Q3 ${fyShort}`, `Q4 ${fyShort}`];
        break;
      }
      case 'half-yearly': {
        const fyShort = `FY${startYear}-${endYear.toString().slice(-2)}`;
        labels = [`H1 ${fyShort}`, `H2 ${fyShort}`];
        break;
      }
      case 'yearly': {
        const fyShort = `FY${startYear}-${endYear.toString().slice(-2)}`;
        labels = [fyShort];
        break;
      }
    }

    const buckets = new Map<string, { pending_amount: number; count: number }>();
    for (const label of labels) {
      buckets.set(label, { pending_amount: 0, count: 0 });
    }

    const getLabel = (date: Date): string => {
      const month = date.getUTCMonth();
      const year = date.getUTCFullYear();
      switch (granularity) {
        case 'monthly': {
          const yr = month >= 3 ? year : year;
          return `${monthNames[month >= 3 ? month - 3 : month + 9]} ${yr}`;
        }
        case 'quarterly': {
          const fyStart = month < 3 ? year - 1 : year;
          const fyEnd = fyStart + 1;
          const fyShort = `FY${fyStart}-${fyEnd.toString().slice(-2)}`;
          if (month >= 3 && month <= 5) return `Q1 ${fyShort}`;
          if (month >= 6 && month <= 8) return `Q2 ${fyShort}`;
          if (month >= 9 && month <= 11) return `Q3 ${fyShort}`;
          return `Q4 ${fyShort}`;
        }
        case 'half-yearly': {
          const fyStart = month < 3 ? year - 1 : year;
          const fyEnd = fyStart + 1;
          const fyShort = `FY${fyStart}-${fyEnd.toString().slice(-2)}`;
          if (month >= 3 && month <= 8) return `H1 ${fyShort}`;
          return `H2 ${fyShort}`;
        }
        case 'yearly': {
          const fyStart = month < 3 ? year - 1 : year;
          const fyEnd = fyStart + 1;
          return `FY${fyStart}-${fyEnd.toString().slice(-2)}`;
        }
      }
      return '';
    };

    const addToBucket = (date: Date, amount: number) => {
      if (date < startDate || date > endDate) return;
      const label = getLabel(date);
      const bucket = buckets.get(label);
      if (bucket) {
        bucket.pending_amount += amount;
        bucket.count += 1;
      }
    };

    // ── 1. Orders (payment_terms.invoice_date is BSON STRING) ──
    const orders = await this.orderModel
      .find({
        'payment_terms.invoice_date': { $gte: startDate.toISOString(), $lte: endDate.toISOString() },
        deleted: { $ne: true },
      })
      .lean();

    for (const order of orders) {
      if (order.status !== 'active') continue;
      for (const term of order.payment_terms || []) {
        if (!term.invoice_date) continue;
        if (term.status === 'proforma') continue;
        if (term.status !== 'pending') continue;
        const termDate = new Date(term.invoice_date);
        if (isNaN(termDate.getTime())) continue;
        addToBucket(termDate, term.calculated_amount || 0);
      }
    }

    // ── 2. Standalone Customizations ──
    const customizations = await this.customizationModel
      .find({
        invoice_date: { $gte: startDate, $lte: endDate },
        deleted: { $ne: true },
      })
      .lean();

    for (const cust of customizations) {
      if (cust.payment_status === 'proforma') continue;
      if (cust.payment_status !== 'pending') continue;
      if (!cust.invoice_date) continue;
      addToBucket(new Date(cust.invoice_date), cust.cost || 0);
    }

    // ── 3. Standalone Licenses ──
    const licenses = await this.licenseModel
      .find({
        invoice_date: { $gte: startDate, $lte: endDate },
        deleted: { $ne: true },
      })
      .lean();

    for (const license of licenses) {
      if (license.payment_status === 'proforma') continue;
      if (license.payment_status !== 'pending') continue;
      if (!license.invoice_date) continue;

      const order = await this.orderModel
        .findById(license.order_id)
        .select('cost_per_license base_cost licenses_with_base_price status')
        .lean();

      if (!order || order.status !== 'active') continue;

      let costPerLicense = order.cost_per_license || 0;
      if (costPerLicense === 0 && order.licenses_with_base_price > 0 && order.base_cost > 0) {
        costPerLicense = order.base_cost / order.licenses_with_base_price;
      }
      const amount = (license.total_license || 0) * costPerLicense;
      if (amount === 0) continue;

      addToBucket(new Date(license.invoice_date), amount);
    }

    // ── 4. AMC payments ──
    const amcs = await (this.amcModel as any)
      .findWithDeleted()
      .populate({ path: 'order_id', model: 'Order' })
      .lean();

    for (const amc of amcs) {
      const order = amc.order_id as any;
      if (order?.status === 'inactive') continue;

      for (const payment of amc.payments || []) {
        if (payment.status === 'proforma') continue;
        if (payment.status !== 'pending') continue;
        if (!payment.invoice_date) continue;
        const paymentDate = new Date(payment.invoice_date);
        if (isNaN(paymentDate.getTime())) continue;
        addToBucket(paymentDate, payment.amc_rate_amount || 0);
      }
    }

    const bucketsArray = labels.map((label) => ({
      label,
      ...buckets.get(label)!,
    }));

    const totals = bucketsArray.reduce(
      (acc, b) => ({
        pending_amount: acc.pending_amount + b.pending_amount,
        count: acc.count + b.count,
      }),
      { pending_amount: 0, count: 0 },
    );

    return {
      fy,
      granularity,
      buckets: bucketsArray,
      totals,
    };
  }

  /**
   * Helper method to determine the Indian financial year and quarter information from a date
   * @param date Date to analyze
   * @returns Object with financial year and quarter information
   */
  private getFinancialYearInfo(date: Date): {
    fiscalYear: string;
    fiscalYearStart: number;
    fiscalYearEnd: number;
    quarter: number;
    quarterName: string;
  } {
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // Determine fiscal year (Apr-Mar)
    // If month is January to March, it's part of previous fiscal year
    const fiscalYearStart = month < 3 ? year - 1 : year;
    const fiscalYearEnd = fiscalYearStart + 1;
    const fiscalYear = `${fiscalYearStart.toString().slice(-2)}-${fiscalYearEnd.toString().slice(-2)}`;
    
    // Determine quarter
    let quarter;
    let quarterName;
    
    if (month >= 3 && month <= 5) {
      // Q1: Apr-Jun
      quarter = 1;
      quarterName = `Q1 FY${fiscalYear}`;
    } else if (month >= 6 && month <= 8) {
      // Q2: Jul-Sep
      quarter = 2;
      quarterName = `Q2 FY${fiscalYear}`;
    } else if (month >= 9 && month <= 11) {
      // Q3: Oct-Dec
      quarter = 3;
      quarterName = `Q3 FY${fiscalYear}`;
    } else {
      // Q4: Jan-Mar
      quarter = 4;
      quarterName = `Q4 FY${fiscalYear}`;
    }
    
    this.loggerService.log(
      JSON.stringify({
        message: 'getFinancialYearInfo: Calculated Indian Financial Year details',
        data: { 
          date: date.toISOString(),
          fiscalYear,
          fiscalYearStart,
          fiscalYearEnd,
          quarter,
          quarterName
        },
      })
    );
    
    return {
      fiscalYear,
      fiscalYearStart,
      fiscalYearEnd,
      quarter,
      quarterName
    };
  }
}
