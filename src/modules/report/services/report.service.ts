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

        const productIds = order.products.map((p: any) => p.toString());
        const productRevenues = new Map<string, number>();

        if (order.products.length === 1) {
          // Single product, assign all revenues to this product
          const productId = productIds[0];
          productRevenues.set(productId, order.base_cost || 0);
        } else {
          // Multiple products
          if (
            order.base_cost_seperation &&
            order.base_cost_seperation.length > 0
          ) {
            // Use base_cost_seperation to distribute revenue
            order.base_cost_seperation.forEach((sep: any) => {
              const productId = sep.product_id.toString();
              const amount = sep.amount || 0;
              productRevenues.set(productId, amount);
            });
          } else {
            // Divide base_cost equally among products
            const amountPerProduct =
              (order.base_cost || 0) / order.products.length;
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
          existing.product = product as unknown as Product;
        }
        productsRevenueMap.set(productId, existing);
      }

      // Process licenses
      const licenses = await this.licenseModel
        .find({
          purchase_date: { $gte: start, $lte: end },
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
            end = new Date(qYear, quarterStartMonth + 3, 0);
          } else {
            const currentDate = new Date();
            const currentQuarter = Math.floor(currentDate.getMonth() / 3);
            const quarterStartMonth = currentQuarter * 3;
            start = new Date(currentDate.getFullYear(), quarterStartMonth, 1);
            end = new Date(
              currentDate.getFullYear(),
              quarterStartMonth + 3,
              0,
              23,
              59,
              59,
            );
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
              purchased_date:
                filter === 'all' ? undefined : { $gte: start, $lte: end },
            })
            .populate({
              path: 'order_id',
              match: productFilter,
              populate: { path: 'client_id' },
            })
            .lean(),
          this.licenseModel
            .find({
              purchase_date:
                filter === 'all' ? undefined : { $gte: start, $lte: end },
            })
            .populate({
              path: 'order_id',
              match: productFilter,
              populate: { path: 'client_id' },
            })
            .lean(),
          this.additionalServiceModel
            .find({
              'date.start':
                filter === 'all' ? undefined : { $gte: start, $lte: end },
            })
            .populate({
              path: 'order_id',
              match: productFilter,
              populate: { path: 'client_id' },
            })
            .lean(),
          this.amcModel.find().lean(),
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
        const period = groupByPeriod(new Date(order.purchased_date));
        const industry =
          (order.client_id as unknown as ClientDocument).industry || 'Unknown';
        const amount = order.base_cost || 0;
        addRevenue(industry, period, amount);
      }

      // Process customizations
      for (const customization of customizations) {
        const period = groupByPeriod(new Date(customization.purchased_date));
        const order = customization.order_id as unknown as OrderDocument;
        if (!order || !order.client_id) continue;
        const industry =
          (order.client_id as unknown as ClientDocument).industry || 'Unknown';
        const amount = customization.cost || 0;
        addRevenue(industry, period, amount);
      }

      // Process licenses
      for (const license of licenses) {
        const period = groupByPeriod(new Date(license.purchase_date));
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
        const period = groupByPeriod(new Date(service.date.start));
        const order = service.order_id as unknown as OrderDocument;
        if (!order || !order.client_id) continue;
        const industry =
          (order.client_id as unknown as ClientDocument).industry || 'Unknown';
        const amount = service.cost || 0;
        addRevenue(industry, period, amount);
      }

      // Process AMCs
      for (const amc of amcs) {
        if (amc.payments.length > 1) {
          for (const payment of amc.payments.slice(1)) {
            if (
              payment.status === PAYMENT_STATUS_ENUM.PAID &&
              payment.from_date >= start &&
              payment.from_date <= end
            ) {
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
        addBilling(term.payment_receive_date, {
          purchase: term.calculated_amount || 0,
        });
      }
    }

    const customizations = await this.customizationModel.find();
    for (const item of customizations) {
      addBilling(item.purchased_date, { purchase: item.cost || 0 });
    }

    const licenses = await this.licenseModel.find();
    for (const lic of licenses) {
      const licenseBilling = (lic.rate?.amount || 0) * (lic.total_license || 0);
      addBilling(lic.purchase_date, { purchase: licenseBilling });
    }

    const services = await this.additionalServiceModel.find();
    for (const service of services) {
      addBilling(service.purchased_date, { purchase: service.cost || 0 });
    }

    const amcs = await this.amcModel.find();
    for (const amc of amcs) {
      for (const payment of amc.payments || []) {
        addBilling(payment.from_date, {
          amc: payment.total_cost || amc.amount || 0,
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
        const diffYear = parseInt(fyA) - parseInt(fyB);
        if (diffYear !== 0) return diffYear;
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
          } else {
            const currentDate = new Date();
            const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
            const quarterStartMonth = (currentQuarter - 1) * 3;
            start = new Date(currentDate.getFullYear(), quarterStartMonth, 1);
            end = new Date(
              currentDate.getFullYear(),
              quarterStartMonth + 3,
              0,
              23,
              59,
              59,
            );
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

      const amcs = await this.amcModel.find(amcQuery).lean();

      const breakdownMap = new Map<
        string,
        {
          totalExpected: number;
          totalCollected: number;
        }
      >();

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
            if (payment.status === PAYMENT_STATUS_ENUM.PAID) {
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
        // Expected on term.date, Received on term.payment_receive_date if any
        if (t.payment_receive_date)
          addData(t.payment_receive_date, t.calculated_amount || 0, 0);
        if (t.payment_receive_date && t.status === PAYMENT_STATUS_ENUM.PAID) {
          addData(t.payment_receive_date, 0, t.calculated_amount || 0);
        }
      }
    }

    // 2) Customizations
    const allCustom = await this.customizationModel.find();
    for (const c of allCustom) {
      // Expected on purchased_date, Received on payment_receive_date if paid
      if (c.purchased_date) addData(c.purchased_date, c.cost || 0, 0);
      if (
        c.payment_receive_date &&
        c.payment_status === PAYMENT_STATUS_ENUM.PAID
      ) {
        addData(c.payment_receive_date, 0, c.cost || 0);
      }
    }

    // 3) Licenses
    const allLicenses = await this.licenseModel.find();
    for (const l of allLicenses) {
      const cost = (l.rate?.amount || 0) * (l.total_license || 0);
      if (l.purchase_date) addData(l.purchase_date, cost, 0);
      if (
        l.payment_receive_date &&
        l.payment_status === PAYMENT_STATUS_ENUM.PAID
      ) {
        addData(l.payment_receive_date, 0, cost);
      }
    }

    // 4) Additional Services
    const allServices = await this.additionalServiceModel.find();
    for (const s of allServices) {
      if (s.purchased_date) addData(s.purchased_date, s.cost || 0, 0);
      if (
        s.payment_receive_date &&
        s.payment_status === PAYMENT_STATUS_ENUM.PAID
      ) {
        addData(s.payment_receive_date, 0, s.cost || 0);
      }
    }

    // 5) AMCs
    const allAmcs = await this.amcModel.find();
    for (const a of allAmcs) {
      // First payment is free, so skip index 0
      for (const pay of a.payments.slice(1)) {
        if (pay.from_date >= start && pay.from_date <= end) {
          // Expected amount is the total_cost or amc_rate_amount for the period
          const expectedAmount =
            pay.total_cost || pay.amc_rate_amount || a.amount || 0;
          addData(new Date(pay.from_date), expectedAmount, 0);

          // If paid, add to received based on actual payment_amount
          if (pay.status === PAYMENT_STATUS_ENUM.PAID && pay.received_date) {
            const receivedAmount = pay.total_cost || expectedAmount;
            addData(new Date(pay.received_date), 0, receivedAmount);
          }
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
      const d = new Date(date);
      switch (filter) {
        case 'monthly':
          return d.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
          });
        case 'quarterly':
          // Indian Financial Year quarter format: Q1 FY23-24 (Apr-Jun 2023)
          const month = d.getMonth();
          const year = d.getFullYear();
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
          const dateYear = d.getFullYear();
          const dateMonth = d.getMonth();
          // If month is January to March, it's part of previous fiscal year
          const fiscalYearStart = dateMonth < 3 ? dateYear - 1 : dateYear;
          return `FY${fiscalYearStart.toString().slice(-2)}-${(fiscalYearStart + 1).toString().slice(-2)}`;
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
        // Expected on term.date
        for (const p of prods) {
          addData(
            term.payment_receive_date,
            ind,
            p.name,
            term.calculated_amount || 0,
            0,
          );
        }
        // Received on term.payment_receive_date if status is paid
        if (
          term.payment_receive_date &&
          term.status === PAYMENT_STATUS_ENUM.PAID
        ) {
          for (const p of prods) {
            addData(
              term.payment_receive_date,
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
      const order = c.order_id as any;
      if (!order) continue;
      const ind = (order.client_id?.industry as string) || 'Unknown';
      const prods = Array.isArray(order.products) ? order.products : [];
      // Expected on purchased_date
      for (const p of prods) {
        addData(c.purchased_date, ind, p.name, c.cost || 0, 0);
      }
      // Received on payment_receive_date if paid
      if (
        c.payment_receive_date &&
        c.payment_status === PAYMENT_STATUS_ENUM.PAID
      ) {
        for (const p of prods) {
          addData(c.payment_receive_date, ind, p.name, 0, c.cost || 0);
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
      const order = lic.order_id as any;
      if (!order) continue;
      const ind = (order.client_id?.industry as string) || 'Unknown';
      const prods = Array.isArray(order.products) ? order.products : [];
      const cost = (lic.rate?.amount || 0) * (lic.total_license || 0);
      // Expected on purchase_date
      for (const p of prods) {
        addData(lic.purchase_date, ind, p.name, cost, 0);
      }
      // Received on payment_receive_date if paid
      if (
        lic.payment_receive_date &&
        lic.payment_status === PAYMENT_STATUS_ENUM.PAID
      ) {
        for (const p of prods) {
          addData(lic.payment_receive_date, ind, p.name, 0, cost);
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
      const order = s.order_id as any;
      if (!order) continue;
      const ind = (order.client_id?.industry as string) || 'Unknown';
      const prods = Array.isArray(order.products) ? order.products : [];
      // Expected on purchased_date
      for (const p of prods) {
        addData(s.purchased_date, ind, p.name, s.cost || 0, 0);
      }
      // Received on payment_receive_date if paid
      if (
        s.payment_receive_date &&
        s.payment_status === PAYMENT_STATUS_ENUM.PAID
      ) {
        for (const p of prods) {
          addData(s.payment_receive_date, ind, p.name, 0, s.cost || 0);
        }
      }
    }

    // 5) AMCs
    // First payment is free for AMC, skip index 0
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
      for (const pay of a.payments.slice(1)) {
        // Entire amount is expected at from_date
        if (pay.from_date >= start && pay.from_date <= end) {
          for (const p of prods) {
            addData(pay.from_date, ind, p.name, a.amount || 0, 0);
          }
          if (pay.status === PAYMENT_STATUS_ENUM.PAID) {
            for (const p of prods) {
              // For AMC, consider same date as paid
              addData(pay.from_date, ind, p.name, 0, a.amount || 0);
            }
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
}
