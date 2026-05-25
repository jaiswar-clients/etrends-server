import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';
import { getModelToken } from '@nestjs/mongoose';
import { LoggerService } from '@/common/logger/services/logger.service';
import { Model } from 'mongoose';
import { AMCDocument, PAYMENT_STATUS_ENUM } from '@/db/schema/amc/amc.schema';
import { OrderDocument } from '@/db/schema/order/product-order.schema';
import { CustomizationDocument } from '@/db/schema/order/customization.schema';
import { LicenseDocument } from '@/db/schema/order/license.schema';
import { AdditionalServiceDocument } from '@/db/schema/order/additional-service.schema';
import { ProductDocument } from '@/db/schema/product.schema';
import { ClientDocument } from '@/db/schema/client.schema';

describe('ReportService', () => {
  let service: ReportService;
  let amcModel: Model<AMCDocument>;
  let orderModel: Model<OrderDocument>;
  let customizationModel: Model<CustomizationDocument>;
  let licenseModel: Model<LicenseDocument>;
  let additionalServiceModel: Model<AdditionalServiceDocument>;
  let productModel: Model<ProductDocument>;
  let clientModel: Model<ClientDocument>;
  let loggerService: LoggerService;

  const createMockModel = (findReturn: any = []) => ({
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(findReturn),
        }),
        lean: jest.fn().mockResolvedValue(findReturn),
      }),
      lean: jest.fn().mockResolvedValue(findReturn),
    }),
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    }),
    findByIdAndUpdate: jest.fn().mockResolvedValue(null),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: getModelToken('Order'), useValue: createMockModel() },
        { provide: getModelToken('License'), useValue: createMockModel() },
        { provide: getModelToken('Customization'), useValue: createMockModel() },
        { provide: getModelToken('Product'), useValue: createMockModel() },
        { provide: getModelToken('Client'), useValue: createMockModel() },
        { provide: getModelToken('AdditionalService'), useValue: createMockModel() },
        {
          provide: getModelToken('AMC'),
          useValue: {
            find: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
              }),
              lean: jest.fn().mockResolvedValue([]),
            }),
            findWithDeleted: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
              }),
              lean: jest.fn().mockResolvedValue([]),
            }),
            findByIdAndUpdate: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: LoggerService,
          useValue: { error: jest.fn(), log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    amcModel = module.get<Model<AMCDocument>>(getModelToken('AMC'));
    orderModel = module.get<Model<OrderDocument>>(getModelToken('Order'));
    customizationModel = module.get<Model<CustomizationDocument>>(
      getModelToken('Customization'),
    );
    licenseModel = module.get<Model<LicenseDocument>>(getModelToken('License'));
    additionalServiceModel = module.get<Model<AdditionalServiceDocument>>(
      getModelToken('AdditionalService'),
    );
    productModel = module.get<Model<ProductDocument>>(getModelToken('Product'));
    clientModel = module.get<Model<ClientDocument>>(getModelToken('Client'));
    loggerService = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const mockOrdersFind = (data: any[]) => {
    (orderModel.find as jest.Mock).mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(data),
      }),
      lean: jest.fn().mockResolvedValue(data),
    });
  };

  const mockSimpleFind = (model: any, data: any[]) => {
    (model.find as jest.Mock).mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(data),
        }),
        lean: jest.fn().mockResolvedValue(data),
      }),
      lean: jest.fn().mockResolvedValue(data),
    });
  };

  const mockAmcFind = (data: any[]) => {
    (amcModel.find as jest.Mock).mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(data),
      }),
      lean: jest.fn().mockResolvedValue(data),
    });
    (amcModel as any).findWithDeleted.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(data),
      }),
      lean: jest.fn().mockResolvedValue(data),
    });
  };

  // ─── getTotalBussinessRevenue ────────────────────────────────────────────
  describe('getTotalBussinessRevenue', () => {
    it('should group new sales by invoice_date and AMC by amc_start_date for monthly filter', async () => {
      const mockOrders = [
        {
          payment_terms: [
            { invoice_date: new Date('2023-06-15'), calculated_amount: 1000, status: 'paid' },
            { invoice_date: new Date('2023-06-20'), calculated_amount: 500, status: 'invoice' },
            // excluded: proforma
            { invoice_date: new Date('2023-06-10'), calculated_amount: 999, status: 'proforma' },
            // excluded: null invoice_date
            { invoice_date: null, calculated_amount: 888, status: 'paid' },
            // excluded: outside range
            { invoice_date: new Date('2023-07-01'), calculated_amount: 777, status: 'paid' },
          ],
        },
      ];

      mockOrdersFind(mockOrders);
      mockSimpleFind(customizationModel, []);
      mockSimpleFind(licenseModel, []);
      mockSimpleFind(additionalServiceModel, []);
      mockAmcFind([
        {
          amount: 200,
          payments: [
            { from_date: new Date('2023-06-01'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 200 },
            { from_date: new Date('2023-06-01'), status: PAYMENT_STATUS_ENUM.PROFORMA, amc_rate_amount: 50 },
          ],
          order_id: { amc_start_date: new Date('2023-06-01') },
        },
      ]);

      const result = await service.getTotalBussinessRevenue('monthly', { month: 6, year: 2023 });

      expect(result).toEqual([
        {
          period: 'June 2023',
          total_amc_billing: 200,
          total_purchase_billing: 1500,
        },
      ]);
    });

    it('should aggregate quarterly using invoice_date for purchases and amc_start_date for AMC', async () => {
      const mockOrders = [
        {
          payment_terms: [
            { invoice_date: new Date('2023-04-15'), calculated_amount: 1000, status: 'paid' },
            { invoice_date: new Date('2023-05-15'), calculated_amount: 1500, status: 'invoice' },
          ],
        },
      ];

      mockOrdersFind(mockOrders);
      mockSimpleFind(customizationModel, [
        { invoice_date: new Date('2023-06-01'), cost: 750, payment_status: 'paid' },
        { invoice_date: new Date('2023-06-01'), cost: 100, payment_status: 'proforma' },
      ]);
      mockSimpleFind(licenseModel, [
        { invoice_date: new Date('2023-04-01'), rate: { amount: 200 }, total_license: 3, payment_status: 'invoice' },
      ]);
      mockSimpleFind(additionalServiceModel, [
        { invoice_date: new Date('2023-05-01'), cost: 400, payment_status: 'paid' },
      ]);
      mockAmcFind([
        {
          amount: 300,
          payments: [
            { from_date: new Date('2023-04-01'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 300 },
            { from_date: new Date('2023-06-01'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 300 },
            { from_date: new Date('2023-04-01'), status: PAYMENT_STATUS_ENUM.PROFORMA, amc_rate_amount: 100 },
          ],
          order_id: { amc_start_date: new Date('2023-04-01') },
        },
      ]);

      const result = await service.getTotalBussinessRevenue('quarterly', { quarter: 'Q1 FY2023' });

      const amcTotal = 600; // 300 + 300, proforma excluded
      const purchaseTotal = 4250; // 1000 + 1500 + 750 + (200*3) + 400

      expect(result).toEqual([
        {
          period: 'Q1 FY23-24',
          total_amc_billing: amcTotal,
          total_purchase_billing: purchaseTotal,
        },
      ]);
    });

    it('should aggregate yearly using Indian Financial Year', async () => {
      const mockOrders = [
        {
          payment_terms: [
            { invoice_date: new Date('2023-01-15'), calculated_amount: 2000, status: 'paid' },
            { invoice_date: new Date('2023-07-15'), calculated_amount: 3000, status: 'invoice' },
          ],
        },
      ];

      mockOrdersFind(mockOrders);
      mockSimpleFind(customizationModel, [
        { invoice_date: new Date('2023-03-01'), cost: 1000, payment_status: 'paid' },
        { invoice_date: new Date('2023-09-01'), cost: 1500, payment_status: 'invoice' },
      ]);
      mockSimpleFind(licenseModel, [
        { invoice_date: new Date('2023-06-01'), rate: { amount: 300 }, total_license: 4, payment_status: 'paid' },
      ]);
      mockSimpleFind(additionalServiceModel, [
        { invoice_date: new Date('2023-02-01'), cost: 600, payment_status: 'invoice' },
        { invoice_date: new Date('2023-08-01'), cost: 800, payment_status: 'paid' },
      ]);
      mockAmcFind([
        {
          amount: 400,
          payments: [
            { from_date: new Date('2023-01-01'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 400 },
            { from_date: new Date('2023-07-01'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 400 },
          ],
          order_id: { amc_start_date: new Date('2023-01-01') },
        },
      ]);

      const result = await service.getTotalBussinessRevenue('yearly', { year: 2023 });

      expect(result).toEqual([
        {
          period: 'FY23-24',
          total_amc_billing: 800,
          total_purchase_billing: 10100,
        },
      ]);
    });

    it('should return empty array when no data matches', async () => {
      mockOrdersFind([]);
      mockSimpleFind(customizationModel, []);
      mockSimpleFind(licenseModel, []);
      mockSimpleFind(additionalServiceModel, []);
      mockAmcFind([]);

      const result = await service.getTotalBussinessRevenue('monthly', { month: 6, year: 2023 });

      expect(result).toEqual([]);
    });

    it('should exclude terms with status proforma and null invoice_date', async () => {
      const mockOrders = [
        {
          payment_terms: [
            { invoice_date: new Date('2023-06-15'), calculated_amount: 1000, status: 'paid' },
            { invoice_date: new Date('2023-06-15'), calculated_amount: 500, status: 'proforma' },
            { invoice_date: null, calculated_amount: 300, status: 'paid' },
          ],
        },
      ];

      mockOrdersFind(mockOrders);
      mockSimpleFind(customizationModel, []);
      mockSimpleFind(licenseModel, []);
      mockSimpleFind(additionalServiceModel, []);
      mockAmcFind([]);

      const result = await service.getTotalBussinessRevenue('monthly', { month: 6, year: 2023 });

      expect(result).toEqual([
        {
          period: 'June 2023',
          total_amc_billing: 0,
          total_purchase_billing: 1000,
        },
      ]);
    });

    it('should skip AMC payments outside date range even if status is paid', async () => {
      mockOrdersFind([]);
      mockSimpleFind(customizationModel, []);
      mockSimpleFind(licenseModel, []);
      mockSimpleFind(additionalServiceModel, []);
      mockAmcFind([
        {
          amount: 500,
          payments: [
            { from_date: new Date('2022-06-01'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 500 },
          ],
          order_id: { amc_start_date: new Date('2022-06-01') },
        },
      ]);

      const result = await service.getTotalBussinessRevenue('monthly', { month: 6, year: 2023 });

      expect(result).toEqual([]);
    });
  });

  // ─── getExpectedVsReceivedChartData ──────────────────────────────────────
  describe('getExpectedVsReceivedChartData', () => {
    it('should compute expected vs received for monthly filter with correct grouping', async () => {
      const mockOrders = [
        {
          payment_terms: [
            { invoice_date: new Date('2023-06-05'), calculated_amount: 1000, status: 'invoice' },
            { invoice_date: new Date('2023-06-15'), calculated_amount: 500, status: 'paid', payment_receive_date: new Date('2023-06-20') },
            { invoice_date: new Date('2023-06-01'), calculated_amount: 200, status: 'proforma' },
          ],
        },
      ];

      mockOrdersFind(mockOrders);
      mockSimpleFind(customizationModel, [
        { invoice_date: new Date('2023-06-10'), cost: 300, payment_status: 'paid', payment_receive_date: new Date('2023-06-25') },
      ]);
      mockSimpleFind(licenseModel, [
        { invoice_date: new Date('2023-06-01'), rate: { amount: 200 }, total_license: 2, payment_status: 'paid', payment_receive_date: new Date('2023-06-18') },
      ]);
      mockSimpleFind(additionalServiceModel, [
        { invoice_date: new Date('2023-06-03'), cost: 150, payment_status: 'pending', payment_receive_date: null },
      ]);
      mockAmcFind([
        {
          amount: 600,
          payments: [
            {}, // first free payment skip
            { from_date: new Date('2023-06-07'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 600 },
            { from_date: new Date('2023-06-07'), status: PAYMENT_STATUS_ENUM.PROFORMA, amc_rate_amount: 100 },
          ],
          order_id: { amc_start_date: new Date('2023-06-01') },
        },
      ]);

      const result = await service.getExpectedVsReceivedChartData('monthly', { month: 6, year: 2023 });

      expect(result).toEqual([
        {
          period: 'June 2023',
          expected_amount: 1000 + 500 + 300 + 200 * 2 + 150 + 600,
          received_amount: 500 + 300 + 200 * 2 + 600,
        },
      ]);
    });

    it('should group AMC by order.amc_start_date not payment.from_date', async () => {
      mockOrdersFind([]);
      mockSimpleFind(customizationModel, []);
      mockSimpleFind(licenseModel, []);
      mockSimpleFind(additionalServiceModel, []);
      mockAmcFind([
        {
          amount: 1000,
          payments: [
            { from_date: new Date('2024-01-01'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 1000 },
          ],
          order_id: { amc_start_date: new Date('2023-04-01') },
        },
      ]);

      const result = await service.getExpectedVsReceivedChartData('yearly', { year: 2024 });

      // AMC payment from_date is Jan 2024 (in FY24-25 range)
      // But grouping is by amc_start_date which is Apr 2023 (in FY23-24)
      // Since filter is yearly 2024 (FY24-25 = Apr 2024 - Mar 2025), the payment from_date IS in range
      // But amc_start_date is Apr 2023 which is FY23-24 — outside the FY24-25 filter range
      // So addBilling will skip it because amc_start_date < start
      expect(result).toEqual([]);
    });

    it('should handle empty data correctly', async () => {
      mockOrdersFind([]);
      mockSimpleFind(customizationModel, []);
      mockSimpleFind(licenseModel, []);
      mockSimpleFind(additionalServiceModel, []);
      mockAmcFind([]);

      const result = await service.getExpectedVsReceivedChartData('monthly', { month: 6, year: 2023 });

      expect(result).toEqual([]);
    });
  });

  // ─── getAMCAnnualBreakdown ───────────────────────────────────────────────
  describe('getAMCAnnualBreakdown', () => {
    it('should group AMC by order.amc_start_date and exclude proforma', async () => {
      mockAmcFind([
        {
          amount: 500,
          payments: [
            { from_date: new Date('2023-06-01'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 500 },
            { from_date: new Date('2023-06-01'), status: PAYMENT_STATUS_ENUM.PENDING, amc_rate_amount: 500 },
            { from_date: new Date('2023-06-01'), status: PAYMENT_STATUS_ENUM.PROFORMA, amc_rate_amount: 100 },
          ],
          order_id: { amc_start_date: new Date('2023-06-01') },
        },
      ]);

      const result = await service.getAMCAnnualBreakdown('monthly', { startDate: new Date('2023-06-01'), endDate: new Date('2023-06-30') });

      expect(result).toEqual([
        {
          period: 'June 2023',
          totalExpected: 1000, // paid + pending, proforma excluded
          totalCollected: 500, // only paid
        },
      ]);
    });

    it('should skip AMC payments with null from_date or outside range', async () => {
      mockAmcFind([
        {
          amount: 500,
          payments: [
            { from_date: new Date('2022-06-01'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 500 },
            { from_date: null, status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 500 },
          ],
          order_id: { amc_start_date: new Date('2022-06-01') },
        },
      ]);

      const result = await service.getAMCAnnualBreakdown('monthly', { startDate: new Date('2023-06-01'), endDate: new Date('2023-06-30') });

      expect(result).toEqual([]);
    });

    it('should skip AMC when order has no amc_start_date', async () => {
      mockAmcFind([
        {
          amount: 500,
          payments: [
            { from_date: new Date('2023-06-01'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 500 },
          ],
          order_id: { amc_start_date: null },
        },
      ]);

      const result = await service.getAMCAnnualBreakdown('monthly', { startDate: new Date('2023-06-01'), endDate: new Date('2023-06-30') });

      expect(result).toEqual([]);
    });
  });

  // ─── getProductWiseRevenueDistribution ───────────────────────────────────
  describe('getProductWiseRevenueDistribution', () => {
    it('should use invoice_date and exclude proforma for all line items', async () => {
      const mockProduct = { _id: 'prod1', name: 'Product A' };

      mockOrdersFind([
        {
          products: [mockProduct],
          payment_terms: [
            { invoice_date: new Date('2023-06-15'), calculated_amount: 1000, status: 'paid' },
            { invoice_date: new Date('2023-06-15'), calculated_amount: 200, status: 'proforma' },
          ],
        },
      ]);

      mockSimpleFind(customizationModel, [
        { product_id: 'prod1', invoice_date: new Date('2023-06-10'), cost: 300, payment_status: 'paid' },
        { product_id: 'prod1', invoice_date: new Date('2023-06-10'), cost: 50, payment_status: 'proforma' },
      ]);

      mockSimpleFind(licenseModel, [
        { product_id: 'prod1', invoice_date: new Date('2023-06-01'), rate: { amount: 100 }, total_license: 2, payment_status: 'invoice' },
      ]);

      mockSimpleFind(additionalServiceModel, [
        { product_id: 'prod1', invoice_date: new Date('2023-06-05'), cost: 150, payment_status: 'paid' },
      ]);

      (productModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProduct),
      });

      const result = await service.getProductWiseRevenueDistribution('monthly', { startDate: new Date('2023-06-01'), endDate: new Date('2023-06-30') });

      expect(result.length).toBe(1);
      expect(result[0].productName).toBe('Product A');
      // 1000 + 300 + (100*2) + 150 = 1550 (proforma excluded)
      expect(result[0].revenue).toBe(1550);
    });

    it('should skip orders with no invoice_date in payment_terms', async () => {
      mockOrdersFind([
        {
          products: [{ _id: 'prod1', name: 'Product A' }],
          payment_terms: [
            { invoice_date: null, calculated_amount: 1000, status: 'paid' },
          ],
        },
      ]);

      mockSimpleFind(customizationModel, []);
      mockSimpleFind(licenseModel, []);
      mockSimpleFind(additionalServiceModel, []);

      const result = await service.getProductWiseRevenueDistribution('monthly', { startDate: new Date('2023-06-01'), endDate: new Date('2023-06-30') });

      expect(result).toEqual([]);
    });
  });

  // ─── getIndustryWiseRevenueDistribution ──────────────────────────────────
  describe('getIndustryWiseRevenueDistribution', () => {
    it('should group new sales by invoice_date and AMC by amc_start_date per industry', async () => {
      const mockClient = { industry: 'Tech' };

      mockOrdersFind([
        {
          client_id: mockClient,
          payment_terms: [
            { invoice_date: new Date('2023-06-15'), calculated_amount: 1000, status: 'paid' },
          ],
        },
      ]);

      mockSimpleFind(customizationModel, [
        { invoice_date: new Date('2023-06-10'), cost: 300, payment_status: 'paid', order_id: { client_id: mockClient } },
      ]);

      mockSimpleFind(licenseModel, []);
      mockSimpleFind(additionalServiceModel, []);
      mockAmcFind([
        {
          amount: 500,
          payments: [
            { from_date: new Date('2023-06-01'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 500 },
          ],
          order_id: { amc_start_date: new Date('2023-06-01'), client_id: mockClient },
          client_id: mockClient,
        },
      ]);

      (clientModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockClient),
      });

      const result = await service.getIndustryWiseRevenueDistribution('monthly', { month: 6, year: 2023 });

      expect(result.length).toBeGreaterThan(0);
      const techEntry = result.find((r: any) => r.industry === 'Tech');
      expect(techEntry).toBeDefined();
      expect(techEntry.period).toBe('June 2023');
      // 1000 + 300 + 500 = 1800
      expect(techEntry.revenue).toBe(1800);
    });

    it('should exclude proforma orders and null invoice_date terms from industry totals', async () => {
      const mockClient = { industry: 'Finance' };

      mockOrdersFind([
        {
          client_id: mockClient,
          payment_terms: [
            { invoice_date: new Date('2023-06-15'), calculated_amount: 1000, status: 'paid' },
            { invoice_date: new Date('2023-06-15'), calculated_amount: 500, status: 'proforma' },
            { invoice_date: null, calculated_amount: 300, status: 'paid' },
          ],
        },
      ]);

      mockSimpleFind(customizationModel, []);
      mockSimpleFind(licenseModel, []);
      mockSimpleFind(additionalServiceModel, []);
      mockAmcFind([]);

      const result = await service.getIndustryWiseRevenueDistribution('monthly', { month: 6, year: 2023 });

      const financeEntry = result.find((r: any) => r.industry === 'Finance');
      expect(financeEntry).toBeDefined();
      expect(financeEntry.revenue).toBe(1000);
    });
  });

  // ─── fetchIndustryRevenueDistribution ────────────────────────────────────
  describe('fetchIndustryRevenueDistribution', () => {
    it('should return industry-product breakdown with correct grouping', async () => {
      const mockProduct = { _id: 'prod1', name: 'Product A' };
      const mockClient = { industry: 'Tech' };

      mockOrdersFind([
        {
          client_id: mockClient,
          products: [mockProduct],
          payment_terms: [
            { invoice_date: new Date('2023-06-15'), calculated_amount: 1000, status: 'paid' },
          ],
        },
      ]);

      mockSimpleFind(customizationModel, []);
      mockSimpleFind(licenseModel, []);
      mockSimpleFind(additionalServiceModel, []);
      mockAmcFind([
        {
          amount: 500,
          payments: [
            { from_date: new Date('2023-06-01'), status: PAYMENT_STATUS_ENUM.PAID, amc_rate_amount: 500 },
          ],
          order_id: { amc_start_date: new Date('2023-06-01'), products: [mockProduct] },
          client_id: mockClient,
        },
      ]);

      const result = await service.fetchIndustryRevenueDistribution('monthly', { month: 6, year: 2023 });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

});

