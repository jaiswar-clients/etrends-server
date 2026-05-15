import { Test, TestingModule } from '@nestjs/testing';
import { RevenueCalculatorService } from './revenue-calculator.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { Order, OrderDocument } from '@/db/schema/order/product-order.schema';
import { License, LicenseDocument } from '@/db/schema/order/license.schema';
import { Customization, CustomizationDocument } from '@/db/schema/order/customization.schema';
import { AdditionalService, AdditionalServiceDocument } from '@/db/schema/order/additional-service.schema';
import { Product, ProductDocument } from '@/db/schema/product.schema';
import { Client, ClientDocument } from '@/db/schema/client.schema';
import { AMC, AMCDocument, PAYMENT_STATUS_ENUM } from '@/db/schema/amc/amc.schema';

describe('RevenueCalculatorService', () => {
  let service: RevenueCalculatorService;
  let orderModel: SoftDeleteModel<OrderDocument>;
  let licenseModel: SoftDeleteModel<LicenseDocument>;
  let customizationModel: SoftDeleteModel<CustomizationDocument>;
  let productModel: SoftDeleteModel<ProductDocument>;
  let additionalServiceModel: SoftDeleteModel<AdditionalServiceDocument>;
  let clientModel: SoftDeleteModel<ClientDocument>;
  let amcModel: SoftDeleteModel<AMCDocument>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevenueCalculatorService,
        {
          provide: getModelToken(Order.name),
          useValue: {
            find: jest.fn().mockReturnThis(),
            findById: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
            populate: jest.fn().mockReturnThis(),
          },
        },
        {
          provide: getModelToken(License.name),
          useValue: {
            find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
            lean: jest.fn().mockReturnThis(),
          },
        },
        {
          provide: getModelToken(Customization.name),
          useValue: {
            find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
            lean: jest.fn().mockReturnThis(),
          },
        },
        {
          provide: getModelToken(AdditionalService.name),
          useValue: {
            find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
            lean: jest.fn().mockReturnThis(),
          },
        },
        {
          provide: getModelToken(Product.name),
          useValue: {
            findById: jest.fn().mockReturnThis(),
            find: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getModelToken(Client.name),
          useValue: {
            find: jest.fn().mockReturnThis(),
            findById: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getModelToken(AMC.name),
          useValue: {
            find: jest.fn().mockReturnThis(),
            findById: jest.fn().mockReturnThis(),
            findByIdAndUpdate: jest.fn().mockReturnThis(),
            findWithDeleted: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnValue({
                  lean: jest.fn().mockResolvedValue([]),
                }),
                lean: jest.fn().mockResolvedValue([]),
              }),
              lean: jest.fn().mockResolvedValue([]),
            }),
            lean: jest.fn().mockResolvedValue([]),
            populate: jest.fn().mockReturnThis(),
          },
        },
      ],
    }).compile();

    service = module.get<RevenueCalculatorService>(RevenueCalculatorService);
    orderModel = module.get<SoftDeleteModel<OrderDocument>>(getModelToken(Order.name));
    licenseModel = module.get<SoftDeleteModel<LicenseDocument>>(getModelToken(License.name));
    customizationModel = module.get<SoftDeleteModel<CustomizationDocument>>(getModelToken(Customization.name));
    productModel = module.get<SoftDeleteModel<ProductDocument>>(getModelToken(Product.name));
    additionalServiceModel = module.get<SoftDeleteModel<AdditionalServiceDocument>>(getModelToken(AdditionalService.name));
    clientModel = module.get<SoftDeleteModel<ClientDocument>>(getModelToken(Client.name));
    amcModel = module.get<SoftDeleteModel<AMCDocument>>(getModelToken(AMC.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPeriodLabel', () => {
    it('should return monthly label with fiscal year', () => {
      const date = new Date('2023-06-15');
      expect(service.getPeriodLabel(date, 'monthly')).toBe('Jun FY23-24');
    });

    it('should return quarterly label', () => {
      const date = new Date('2023-06-15');
      expect(service.getPeriodLabel(date, 'quarterly')).toBe('Q1 FY23-24');
    });

    it('should return yearly label', () => {
      const date = new Date('2023-06-15');
      expect(service.getPeriodLabel(date, 'yearly')).toBe('FY23-24');
    });

    it('should handle January-March as previous fiscal year', () => {
      const date = new Date('2024-01-15');
      expect(service.getPeriodLabel(date, 'yearly')).toBe('FY23-24');
    });
  });

  describe('calculateNewSalesRevenue', () => {
    it('should group by invoice_date and exclude proforma/null invoice_date', async () => {
      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          products: [new Types.ObjectId()],
          purchased_date: new Date('2023-04-15'),
          payment_terms: [
            { invoice_date: new Date('2023-05-10'), calculated_amount: 1000, status: 'paid' },
            { invoice_date: new Date('2023-06-15'), calculated_amount: 2000, status: 'invoice' },
            { invoice_date: null, calculated_amount: 500, status: 'paid' },
            { invoice_date: new Date('2023-07-01'), calculated_amount: 800, status: 'proforma' },
            { invoice_date: new Date('2023-05-10'), calculated_amount: 300, status: 'pending' },
          ],
        },
      ];

      jest.spyOn(orderModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockOrders),
        }),
      } as any);

      const start = new Date('2023-04-01');
      const end = new Date('2024-03-31');
      const result = await service.calculateNewSalesRevenue(start, end, 'monthly');

      // Should only include paid (1000) and invoice (2000) terms with invoice_date
      // Grouped by invoice_date months: May=1000, Jun=2000
      expect(result.get('May FY23-24')).toBe(1000);
      expect(result.get('Jun FY23-24')).toBe(2000);
      expect(result.has('Jul FY23-24')).toBe(false); // proforma excluded
      expect(result.get('Apr FY23-24')).toBeUndefined();
    });

    it('should not include orders outside purchased_date range', async () => {
      jest.spyOn(orderModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      } as any);

      const start = new Date('2023-04-01');
      const end = new Date('2024-03-31');
      const result = await service.calculateNewSalesRevenue(start, end, 'monthly');

      expect(result.size).toBe(0);
    });

    it('should skip orders without products (not new sale)', async () => {
      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          products: [],
          purchased_date: new Date('2023-04-15'),
          payment_terms: [
            { invoice_date: new Date('2023-05-10'), calculated_amount: 1000, status: 'paid' },
          ],
        },
      ];

      jest.spyOn(orderModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockOrders),
        }),
      } as any);

      const start = new Date('2023-04-01');
      const end = new Date('2024-03-31');
      const result = await service.calculateNewSalesRevenue(start, end, 'monthly');

      expect(result.size).toBe(0);
    });
  });

  describe('calculateAMCRevenue', () => {
    it('should group by order.amc_start_date and exclude proforma', async () => {
      const orderId = new Types.ObjectId();
      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          order_id: {
            _id: orderId,
            amc_start_date: new Date('2023-04-01'),
          },
          payments: [
            { from_date: new Date('2023-04-01'), amc_rate_amount: 1000, status: PAYMENT_STATUS_ENUM.PAID },
            { from_date: new Date('2024-04-01'), amc_rate_amount: 1200, status: PAYMENT_STATUS_ENUM.PAID },
            { from_date: new Date('2025-04-01'), amc_rate_amount: 1500, status: PAYMENT_STATUS_ENUM.PROFORMA },
          ],
        },
      ];

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAMCs),
        }),
      } as any);

      const start = new Date('2023-04-01');
      const end = new Date('2024-03-31');
      const result = await service.calculateAMCRevenue(start, end, 'yearly');

      // Only first payment is in range, grouped by amc_start_date (Apr 2023 -> FY23-24)
      expect(result.get('FY23-24')).toBe(1000);
      // Second payment is outside range
      // Third payment is proforma
    });

    it('should skip AMCs without order or amc_start_date', async () => {
      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          order_id: null,
          payments: [
            { from_date: new Date('2023-04-01'), amc_rate_amount: 1000, status: PAYMENT_STATUS_ENUM.PAID },
          ],
        },
        {
          _id: new Types.ObjectId(),
          order_id: { _id: new Types.ObjectId() }, // no amc_start_date
          payments: [
            { from_date: new Date('2023-04-01'), amc_rate_amount: 500, status: PAYMENT_STATUS_ENUM.PAID },
          ],
        },
      ];

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAMCs),
        }),
      } as any);

      const start = new Date('2023-04-01');
      const end = new Date('2024-03-31');
      const result = await service.calculateAMCRevenue(start, end, 'monthly');

      expect(result.size).toBe(0);
    });

    it('should use payment.from_date for range eligibility but amc_start_date for grouping', async () => {
      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          order_id: {
            _id: new Types.ObjectId(),
            amc_start_date: new Date('2022-04-01'), // AMC started in FY22-23
          },
          payments: [
            // Payment in FY23-24 range
            { from_date: new Date('2023-04-01'), amc_rate_amount: 1000, status: PAYMENT_STATUS_ENUM.PAID },
            // Payment outside range
            { from_date: new Date('2024-04-01'), amc_rate_amount: 1200, status: PAYMENT_STATUS_ENUM.PAID },
          ],
        },
      ];

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAMCs),
        }),
      } as any);

      const start = new Date('2023-04-01');
      const end = new Date('2024-03-31');
      const result = await service.calculateAMCRevenue(start, end, 'yearly');

      // Grouped by amc_start_date (FY22-23) even though payment is in FY23-24
      expect(result.get('FY22-23')).toBe(1000);
      expect(result.has('FY23-24')).toBe(false);
    });
  });

  describe('getRevenueDashboard', () => {
    it('should combine new sales and AMC with correct grouping', async () => {
      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          products: [new Types.ObjectId()],
          purchased_date: new Date('2023-04-15'),
          payment_terms: [
            { invoice_date: new Date('2023-04-20'), calculated_amount: 5000, status: 'paid' },
          ],
        },
      ];

      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          order_id: {
            _id: new Types.ObjectId(),
            amc_start_date: new Date('2023-04-01'),
          },
          payments: [
            { from_date: new Date('2023-04-01'), amc_rate_amount: 1000, status: PAYMENT_STATUS_ENUM.PAID },
          ],
        },
      ];

      jest.spyOn(orderModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockOrders),
        }),
      } as any);

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAMCs),
        }),
      } as any);

      const result = await service.getRevenueDashboard({ year: 2023, filter: 'yearly' });

      expect(result.summary.totalNewSalesRevenue).toBe(5000);
      expect(result.summary.totalAMCRevenue).toBe(1000);
      expect(result.summary.grandTotalRevenue).toBe(6000);
    });
  });

  describe('getExpectedVsCollected', () => {
    it('should group new sales by invoice_date and AMC by amc_start_date', async () => {
      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          products: [new Types.ObjectId()],
          purchased_date: new Date('2023-04-15'),
          payment_terms: [
            { invoice_date: new Date('2023-05-10'), calculated_amount: 3000, status: 'paid' },
            { invoice_date: new Date('2023-06-15'), calculated_amount: 2000, status: 'invoice' },
          ],
        },
      ];

      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          order_id: {
            _id: new Types.ObjectId(),
            amc_start_date: new Date('2023-04-01'),
          },
          payments: [
            { from_date: new Date('2023-04-01'), amc_rate_amount: 1000, status: PAYMENT_STATUS_ENUM.PAID },
            { from_date: new Date('2024-04-01'), amc_rate_amount: 1200, status: PAYMENT_STATUS_ENUM.PAID },
          ],
        },
      ];

      jest.spyOn(orderModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOrders),
      } as any);

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAMCs),
        }),
      } as any);

      const result = await service.getExpectedVsCollected({ fiscalYear: 2023, filter: 'monthly' });

      // New sales: expected = 3000+2000=5000, collected = 3000
      expect(result.newSales.expected).toBe(5000);
      expect(result.newSales.collected).toBe(3000);

      // AMC: expected = 1000 (only first payment in range), collected = 1000
      expect(result.amc.expected).toBe(1000);
      expect(result.amc.collected).toBe(1000);

      // Breakdown grouped correctly
      const mayBreakdown = result.newSales.breakdown.find(b => b.period === 'May FY23-24');
      expect(mayBreakdown?.expected).toBe(3000);
      expect(mayBreakdown?.collected).toBe(3000);

      const junBreakdown = result.newSales.breakdown.find(b => b.period === 'Jun FY23-24');
      expect(junBreakdown?.expected).toBe(2000);
      expect(junBreakdown?.collected).toBe(0);

      // AMC breakdown grouped by amc_start_date (Apr)
      const aprBreakdown = result.amc.breakdown.find(b => b.period === 'Apr FY23-24');
      expect(aprBreakdown?.expected).toBe(1000);
    });

    it('should exclude proforma from both new sales and AMC', async () => {
      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          products: [new Types.ObjectId()],
          purchased_date: new Date('2023-04-15'),
          payment_terms: [
            { invoice_date: new Date('2023-05-10'), calculated_amount: 3000, status: 'proforma' },
          ],
        },
      ];

      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          order_id: {
            _id: new Types.ObjectId(),
            amc_start_date: new Date('2023-04-01'),
          },
          payments: [
            { from_date: new Date('2023-04-01'), amc_rate_amount: 1000, status: PAYMENT_STATUS_ENUM.PROFORMA },
          ],
        },
      ];

      jest.spyOn(orderModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOrders),
      } as any);

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAMCs),
        }),
      } as any);

      const result = await service.getExpectedVsCollected({ fiscalYear: 2023, filter: 'monthly' });

      expect(result.newSales.expected).toBe(0);
      expect(result.newSales.collected).toBe(0);
      expect(result.amc.expected).toBe(0);
      expect(result.amc.collected).toBe(0);
    });
  });

  describe('getMonthlyBreakdown', () => {
    it('should return details grouped by invoice_date for new sales and amc_start_date for AMC', async () => {
      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          products: [{ name: 'Product A' }],
          client_id: { name: 'Client A' },
          purchased_date: new Date('2023-04-15'),
          payment_terms: [
            { invoice_date: new Date('2023-04-20'), calculated_amount: 3000, status: 'paid' },
          ],
        },
      ];

      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          order_id: {
            _id: new Types.ObjectId(),
            amc_start_date: new Date('2023-04-01'),
          },
          client_id: { name: 'Client B' },
          payments: [
            { from_date: new Date('2023-04-01'), amc_rate_amount: 1000, status: PAYMENT_STATUS_ENUM.PAID },
          ],
        },
      ];

      jest.spyOn(orderModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrders),
      } as any);

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockAMCs),
      } as any);

      const result = await service.getMonthlyBreakdown({ year: 2023, month: 4 });

      expect(result.newSales.total).toBe(3000);
      expect(result.newSales.details[0].date).toEqual(new Date('2023-04-20'));
      expect(result.amc.total).toBe(1000);
      expect(result.amc.details[0].date).toEqual(new Date('2023-04-01'));
    });
  });

  describe('getTopPerformers', () => {
    it('should calculate revenue by client using invoice_date for new sales and amc_start_date for AMC', async () => {
      const clientId = new Types.ObjectId().toString();

      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          client_id: new Types.ObjectId(clientId),
          products: [new Types.ObjectId()],
          purchased_date: new Date('2023-04-15'),
          payment_terms: [
            { invoice_date: new Date('2023-05-10'), calculated_amount: 5000, status: 'paid' },
          ],
        },
      ];

      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          client_id: new Types.ObjectId(clientId),
          order_id: {
            _id: new Types.ObjectId(),
            amc_start_date: new Date('2023-04-01'),
          },
          payments: [
            { from_date: new Date('2023-04-01'), amc_rate_amount: 2000, status: PAYMENT_STATUS_ENUM.PAID },
          ],
        },
      ];

      const mockClients = [
        { _id: new Types.ObjectId(clientId), name: 'Test Client', industry: 'IT' },
      ];

      jest.spyOn(orderModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOrders),
      } as any);

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAMCs),
        }),
        lean: jest.fn().mockResolvedValue(mockAMCs),
      } as any);

      jest.spyOn(clientModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockClients),
      } as any);

      jest.spyOn(orderModel, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      } as any);

      const result = await service.getTopPerformers(2023, 5);

      expect(result.topClients.length).toBe(1);
      expect(result.topClients[0].totalRevenue).toBe(7000); // 5000 + 2000
      expect(result.topClients[0].newSalesRevenue).toBe(5000);
      expect(result.topClients[0].amcRevenue).toBe(2000);
    });
  });

  describe('getClientConcentrationRisk', () => {
    it('should use invoice_date for new sales and amc_start_date for AMC', async () => {
      const clientId = new Types.ObjectId().toString();

      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          client_id: new Types.ObjectId(clientId),
          products: [new Types.ObjectId()],
          purchased_date: new Date('2023-04-15'),
          payment_terms: [
            { invoice_date: new Date('2023-05-10'), calculated_amount: 10000, status: 'paid' },
          ],
        },
      ];

      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          client_id: new Types.ObjectId(clientId),
          order_id: {
            _id: new Types.ObjectId(),
            amc_start_date: new Date('2023-04-01'),
          },
          payments: [
            { from_date: new Date('2023-04-01'), amc_rate_amount: 5000, status: PAYMENT_STATUS_ENUM.PAID },
          ],
        },
      ];

      const mockClients = [
        { _id: new Types.ObjectId(clientId), name: 'Test Client', industry: 'IT' },
      ];

      jest.spyOn(orderModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOrders),
      } as any);

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAMCs),
        }),
      } as any);

      jest.spyOn(clientModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockClients),
      } as any);

      const result = await service.getClientConcentrationRisk(2023);

      expect(result.totalRevenue).toBe(15000);
      expect(result.industryDiversification[0].totalRevenue).toBe(15000);
    });
  });

  describe('calculateNewSalesRevenue with standalone customizations and licenses', () => {
    it('should include standalone customizations and licenses in new sales', async () => {
      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          products: [new Types.ObjectId()],
          payment_terms: [
            { invoice_date: '2023-05-10T00:00:00.000Z', calculated_amount: 10000, status: 'paid' },
          ],
        },
      ];

      const mockCustomizations = [
        {
          _id: new Types.ObjectId(),
          order_id: new Types.ObjectId(),
          invoice_date: new Date('2023-06-15'),
          cost: 5000,
          payment_status: 'paid',
        },
      ];

      const mockLicenses = [
        {
          _id: new Types.ObjectId(),
          order_id: new Types.ObjectId(),
          invoice_date: new Date('2023-07-20'),
          total_license: 10,
          payment_status: 'paid',
        },
      ];

      const mockLinkedOrder = {
        _id: mockLicenses[0].order_id,
        cost_per_license: 100,
      };

      jest.spyOn(orderModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockOrders),
        }),
      } as any);

      jest.spyOn(customizationModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockCustomizations),
      } as any);

      jest.spyOn(licenseModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockLicenses),
      } as any);

      jest.spyOn(orderModel, 'findById').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockLinkedOrder),
        }),
      } as any);

      const start = new Date('2023-04-01');
      const end = new Date('2024-03-31');
      const result = await service.calculateNewSalesRevenue(start, end, 'monthly');

      // Order term: 10000 in May
      expect(result.get('May FY23-24')).toBe(10000);
      // Customization: 5000 in Jun
      expect(result.get('Jun FY23-24')).toBe(5000);
      // License: 10 * 100 = 1000 in Jul
      expect(result.get('Jul FY23-24')).toBe(1000);
    });

    it('should handle string invoice_date in payment_terms (real DB format)', async () => {
      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          products: [new Types.ObjectId()],
          payment_terms: [
            // Real DB stores invoice_date as ISO string, not Date
            { invoice_date: '2023-05-10T18:30:00.000Z', calculated_amount: 5000, status: 'paid' },
            { invoice_date: '2023-06-15T18:30:00.000Z', calculated_amount: 3000, status: 'invoice' },
          ],
        },
      ];

      jest.spyOn(orderModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockOrders),
        }),
      } as any);

      jest.spyOn(customizationModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      } as any);

      jest.spyOn(licenseModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      } as any);

      const start = new Date('2023-04-01');
      const end = new Date('2024-03-31');
      const result = await service.calculateNewSalesRevenue(start, end, 'monthly');

      expect(result.get('May FY23-24')).toBe(5000);
      expect(result.get('Jun FY23-24')).toBe(3000);
    });

    it('should compute license cost from base_cost / licenses_with_base_price when cost_per_license is 0', async () => {
      const mockLicenses = [
        {
          _id: new Types.ObjectId(),
          order_id: new Types.ObjectId(),
          invoice_date: new Date('2023-08-15'),
          total_license: 10,
          payment_status: 'paid',
        },
      ];

      const mockLinkedOrder = {
        _id: mockLicenses[0].order_id,
        cost_per_license: 0,
        base_cost: 1000000,
        licenses_with_base_price: 25,
      };

      jest.spyOn(orderModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      } as any);

      jest.spyOn(customizationModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      } as any);

      jest.spyOn(licenseModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockLicenses),
      } as any);

      jest.spyOn(orderModel, 'findById').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockLinkedOrder),
        }),
      } as any);

      const start = new Date('2023-04-01');
      const end = new Date('2024-03-31');
      const result = await service.calculateNewSalesRevenue(start, end, 'monthly');

      // 10 licenses * (1,000,000 / 25) = 10 * 40,000 = 400,000
      expect(result.get('Aug FY23-24')).toBe(400000);
    });
  });

  describe('AMC inactive order exclusion', () => {
    it('should exclude AMC payments from inactive orders', async () => {
      const activeOrderId = new Types.ObjectId();
      const inactiveOrderId = new Types.ObjectId();

      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          order_id: {
            _id: activeOrderId,
            amc_start_date: new Date('2023-04-01'),
            status: 'active',
          },
          payments: [
            { from_date: new Date('2023-04-01'), amc_rate_amount: 1000, status: PAYMENT_STATUS_ENUM.PAID },
          ],
        },
        {
          _id: new Types.ObjectId(),
          order_id: {
            _id: inactiveOrderId,
            amc_start_date: new Date('2023-04-01'),
            status: 'inactive',
          },
          payments: [
            { from_date: new Date('2023-04-01'), amc_rate_amount: 2000, status: PAYMENT_STATUS_ENUM.PAID },
          ],
        },
      ];

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAMCs),
        }),
      } as any);

      const start = new Date('2023-04-01');
      const end = new Date('2024-03-31');
      const result = await service.calculateAMCRevenue(start, end, 'yearly');

      // Only active order's AMC payment should count
      expect(result.get('FY23-24')).toBe(1000);
    });

    it('should exclude inactive orders in getRevenueDashboard', async () => {
      const mockOrders: any[] = [];

      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          order_id: {
            _id: new Types.ObjectId(),
            amc_start_date: new Date('2023-04-01'),
            status: 'inactive',
          },
          payments: [
            { from_date: new Date('2023-04-01'), amc_rate_amount: 5000, status: PAYMENT_STATUS_ENUM.PAID },
          ],
        },
      ];

      jest.spyOn(orderModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockOrders),
        }),
      } as any);

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAMCs),
        }),
      } as any);

      const result = await service.getRevenueDashboard({ year: 2023, filter: 'yearly' });

      expect(result.summary.totalNewSalesRevenue).toBe(0);
      expect(result.summary.totalAMCRevenue).toBe(0);
    });
  });

  describe('getClientHealthMetrics', () => {
    it('should detect active clients via orders or AMC payments in FY', async () => {
      const clientId = new Types.ObjectId().toString();

      const mockClients = [
        { _id: new Types.ObjectId(clientId), name: 'Test Client' },
      ];

      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          client_id: new Types.ObjectId(clientId),
          purchased_date: new Date('2023-05-10'),
          payment_terms: [],
        },
      ];

      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          client_id: new Types.ObjectId(clientId),
          payments: [
            { from_date: new Date('2023-04-01'), status: PAYMENT_STATUS_ENUM.PAID },
          ],
        },
      ];

      jest.spyOn(clientModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockClients),
      } as any);

      jest.spyOn(orderModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOrders),
      } as any);

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAMCs),
        }),
      } as any);

      const result = await service.getClientHealthMetrics(2023);

      expect(result.totalClients).toBe(1);
      expect(result.activeClients).toBe(1);
      expect(result.inactiveClients).toBe(0);
    });

    it('should exclude proforma AMC payments from active client detection', async () => {
      const clientId = new Types.ObjectId().toString();

      const mockClients = [
        { _id: new Types.ObjectId(clientId), name: 'Test Client' },
      ];

      const mockOrders: any[] = [];

      const mockAMCs = [
        {
          _id: new Types.ObjectId(),
          client_id: new Types.ObjectId(clientId),
          payments: [
            { from_date: new Date('2023-04-01'), status: PAYMENT_STATUS_ENUM.PROFORMA },
          ],
        },
      ];

      jest.spyOn(clientModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockClients),
      } as any);

      jest.spyOn(orderModel, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOrders),
      } as any);

      jest.spyOn(amcModel, 'findWithDeleted').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAMCs),
        }),
      } as any);

      const result = await service.getClientHealthMetrics(2023);

      expect(result.activeClients).toBe(0);
      expect(result.inactiveClients).toBe(1);
    });
  });
});
