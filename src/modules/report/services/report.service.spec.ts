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

describe('ReportService', () => {
  let service: ReportService;
  let amcModel: Model<AMCDocument>;
  let orderModel: Model<OrderDocument>;
  let customizationModel: Model<CustomizationDocument>;
  let licenseModel: Model<LicenseDocument>;
  let additionalServiceModel: Model<AdditionalServiceDocument>;
  let loggerService: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: getModelToken('Order'), useValue: {} },
        { provide: getModelToken('License'), useValue: {} },
        { provide: getModelToken('Customization'), useValue: {} },
        { provide: getModelToken('Product'), useValue: {} },
        { provide: getModelToken('Client'), useValue: {} },
        { provide: getModelToken('AdditionalService'), useValue: {} },
        {
          provide: getModelToken('AMC'),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: { error: jest.fn() },
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

    loggerService = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTotalBussinessRevenue', () => {
    it('should calculate total business revenue correctly for monthly filter', async () => {
      // Mock data
      const mockOrders = [
        {
          payment_terms: [
            { date: new Date('2023-06-15'), calculated_amount: 1000 },
          ],
        },
      ];
      const mockCustomizations = [
        { purchased_date: new Date('2023-06-20'), cost: 500 },
      ];
      const mockLicenses = [
        {
          purchase_date: new Date('2023-06-25'),
          rate: { amount: 100 },
          total_license: 2,
        },
      ];
      const mockServices = [
        { purchased_date: new Date('2023-06-10'), cost: 300 },
      ];
      const mockAMCs = [
        {
          amount: 200,
          payments: [{ from_date: new Date('2023-06-01') }],
        },
      ];

      // Setup mocks
      orderModel.find = jest.fn().mockResolvedValue(mockOrders);
      customizationModel.find = jest.fn().mockResolvedValue(mockCustomizations);
      licenseModel.find = jest.fn().mockResolvedValue(mockLicenses);
      additionalServiceModel.find = jest.fn().mockResolvedValue(mockServices);
      amcModel.find = jest.fn().mockResolvedValue(mockAMCs);

      const result = await service.getTotalBussinessRevenue('monthly', {
        month: 6,
        year: 2023,
      });

      expect(result).toEqual([
        {
          period: 'June 2023',
          total_amc_billing: 200,
          total_purchase_billing: 2000, // 1000 + 500 + (100 * 2) + 300
        },
      ]);
    });

    it('should calculate total business revenue correctly for quarterly filter', async () => {
      // Mock data spanning multiple months in a quarter
      const mockOrders = [
        {
          payment_terms: [
            { date: new Date('2023-04-15'), calculated_amount: 1000 },
            { date: new Date('2023-05-15'), calculated_amount: 1500 },
          ],
        },
      ];
      const mockCustomizations = [
        { purchased_date: new Date('2023-06-01'), cost: 750 },
      ];
      const mockLicenses = [
        {
          purchase_date: new Date('2023-04-01'),
          rate: { amount: 200 },
          total_license: 3,
        },
      ];
      const mockServices = [
        { purchased_date: new Date('2023-05-01'), cost: 400 },
      ];
      const mockAMCs = [
        {
          amount: 300,
          payments: [
            { from_date: new Date('2023-04-01') },
            { from_date: new Date('2023-06-01') },
          ],
        },
      ];

      // Setup mocks
      orderModel.find = jest.fn().mockResolvedValue(mockOrders);
      customizationModel.find = jest.fn().mockResolvedValue(mockCustomizations);
      licenseModel.find = jest.fn().mockResolvedValue(mockLicenses);
      additionalServiceModel.find = jest.fn().mockResolvedValue(mockServices);
      amcModel.find = jest.fn().mockResolvedValue(mockAMCs);

      const result = await service.getTotalBussinessRevenue('quarterly', {
        quarter: 'Q2 2023',
      });

      expect(result).toEqual([
        {
          period: 'Q2 2023',
          total_amc_billing: 600, // 300 * 2 payments
          total_purchase_billing: 4250, // 1000 + 1500 + 750 + (200 * 3) + 400
        },
      ]);
    });

    it('should calculate total business revenue correctly for yearly filter', async () => {
      // Mock data for entire year
      const mockOrders = [
        {
          payment_terms: [
            { date: new Date('2023-01-15'), calculated_amount: 2000 },
            { date: new Date('2023-07-15'), calculated_amount: 3000 },
          ],
        },
      ];
      const mockCustomizations = [
        { purchased_date: new Date('2023-03-01'), cost: 1000 },
        { purchased_date: new Date('2023-09-01'), cost: 1500 },
      ];
      const mockLicenses = [
        {
          purchase_date: new Date('2023-06-01'),
          rate: { amount: 300 },
          total_license: 4,
        },
      ];
      const mockServices = [
        { purchased_date: new Date('2023-02-01'), cost: 600 },
        { purchased_date: new Date('2023-08-01'), cost: 800 },
      ];
      const mockAMCs = [
        {
          amount: 400,
          payments: [
            { from_date: new Date('2023-01-01') },
            { from_date: new Date('2023-07-01') },
          ],
        },
      ];

      // Setup mocks
      orderModel.find = jest.fn().mockResolvedValue(mockOrders);
      customizationModel.find = jest.fn().mockResolvedValue(mockCustomizations);
      licenseModel.find = jest.fn().mockResolvedValue(mockLicenses);
      additionalServiceModel.find = jest.fn().mockResolvedValue(mockServices);
      amcModel.find = jest.fn().mockResolvedValue(mockAMCs);

      const result = await service.getTotalBussinessRevenue('yearly', {
        year: 2023,
      });

      expect(result).toEqual([
        {
          period: '2023',
          total_amc_billing: 800, // 400 * 2 payments
          total_purchase_billing: 10100, // 2000 + 3000 + 1000 + 1500 + (300 * 4) + 600 + 800
        },
      ]);
    });

    it('should handle empty data correctly', async () => {
      // Setup mocks with empty arrays
      orderModel.find = jest.fn().mockResolvedValue([]);
      customizationModel.find = jest.fn().mockResolvedValue([]);
      licenseModel.find = jest.fn().mockResolvedValue([]);
      additionalServiceModel.find = jest.fn().mockResolvedValue([]);
      amcModel.find = jest.fn().mockResolvedValue([]);

      const result = await service.getTotalBussinessRevenue('monthly', {
        month: 6,
        year: 2023,
      });

      expect(result).toEqual([]);
    });

    it('should handle data outside filter range correctly', async () => {
      // Mock data outside the filter range
      const mockOrders = [
        {
          payment_terms: [
            { date: new Date('2022-06-15'), calculated_amount: 1000 },
          ],
        },
      ];
      const mockCustomizations = [
        { purchased_date: new Date('2022-06-20'), cost: 500 },
      ];

      // Setup mocks
      orderModel.find = jest.fn().mockResolvedValue(mockOrders);
      customizationModel.find = jest.fn().mockResolvedValue(mockCustomizations);
      licenseModel.find = jest.fn().mockResolvedValue([]);
      additionalServiceModel.find = jest.fn().mockResolvedValue([]);
      amcModel.find = jest.fn().mockResolvedValue([]);

      const result = await service.getTotalBussinessRevenue('monthly', {
        month: 6,
        year: 2023,
      });

      expect(result).toEqual([]);
    });
  });

  describe('getExpectedVsReceivedChartData', () => {
    it('should compute expected vs. received data for a monthly filter', async () => {
      const mockOrders = [
        {
          payment_terms: [
            {
              date: new Date('2023-06-05'),
              calculated_amount: 1000,
              status: undefined,
            },
            {
              date: new Date('2023-06-15'),
              payment_receive_date: new Date('2023-06-20'),
              calculated_amount: 500,
              status: PAYMENT_STATUS_ENUM.PAID,
            },
          ],
        },
      ];
      const mockCustomizations = [
        {
          purchased_date: new Date('2023-06-10'),
          cost: 300,
          payment_receive_date: new Date('2023-06-25'),
          payment_status: PAYMENT_STATUS_ENUM.PAID,
        },
      ];
      const mockLicenses = [
        {
          purchase_date: new Date('2023-06-01'),
          rate: { amount: 200 },
          total_license: 2,
          payment_receive_date: new Date('2023-06-18'),
          payment_status: PAYMENT_STATUS_ENUM.PAID,
        },
      ];
      const mockServices = [
        {
          purchased_date: new Date('2023-06-03'),
          cost: 150,
          payment_receive_date: null,
          payment_status: PAYMENT_STATUS_ENUM.PENDING,
        },
      ];
      const mockAMCs = [
        {
          amount: 600,
          payments: [
            {}, // first payment is free, skip
            {
              from_date: new Date('2023-06-07'),
              status: PAYMENT_STATUS_ENUM.PAID,
            },
          ],
        },
      ];

      orderModel.find = jest.fn().mockResolvedValue(mockOrders);
      customizationModel.find = jest.fn().mockResolvedValue(mockCustomizations);
      licenseModel.find = jest.fn().mockResolvedValue(mockLicenses);
      additionalServiceModel.find = jest.fn().mockResolvedValue(mockServices);
      amcModel.find = jest.fn().mockResolvedValue(mockAMCs);

      const result = await service.getExpectedVsReceivedChartData('monthly', {
        month: 6,
        year: 2023,
      });

      expect(result).toEqual([
        {
          period: 'June 2023',
          expected_amount: 1000 + 500 + 300 + 200 * 2 + 150 + 600,
          received_amount: 500 + 300 + 200 * 2 + 600,
        },
      ]);
    });

    it('should compute expected vs. received data for a quarterly filter', async () => {
      const mockOrders = [
        {
          payment_terms: [
            {
              date: new Date('2023-04-10'),
              calculated_amount: 1000,
              status: undefined,
            },
            {
              date: new Date('2023-05-01'),
              payment_receive_date: new Date('2023-05-15'),
              calculated_amount: 100,
              status: PAYMENT_STATUS_ENUM.PAID,
            },
          ],
        },
      ];
      const mockCustomizations = [
        {
          purchased_date: new Date('2023-06-10'),
          cost: 300,
          payment_receive_date: null,
          payment_status: PAYMENT_STATUS_ENUM.PENDING,
        },
      ];
      const mockLicenses = [
        {
          purchase_date: new Date('2023-06-05'),
          rate: { amount: 100 },
          total_license: 2,
          payment_receive_date: new Date('2023-06-06'),
          payment_status: PAYMENT_STATUS_ENUM.PAID,
        },
      ];
      const mockServices = [];
      const mockAMCs = [
        {
          amount: 400,
          payments: [
            {},
            {
              from_date: new Date('2023-05-20'),
              status: PAYMENT_STATUS_ENUM.PAID,
            },
            {
              from_date: new Date('2023-04-20'),
              status: PAYMENT_STATUS_ENUM.PENDING,
            },
          ],
        },
      ];

      orderModel.find = jest.fn().mockResolvedValue(mockOrders);
      customizationModel.find = jest.fn().mockResolvedValue(mockCustomizations);
      licenseModel.find = jest.fn().mockResolvedValue(mockLicenses);
      additionalServiceModel.find = jest.fn().mockResolvedValue(mockServices);
      amcModel.find = jest.fn().mockResolvedValue(mockAMCs);

      const result = await service.getExpectedVsReceivedChartData('quarterly', {
        quarter: 'Q2 2023',
      });

      expect(result).toEqual([
        {
          period: 'Q2 2023',
          expected_amount: 1000 + 100 + 300 + 100 * 2 + 400 + 400,
          received_amount: 100 + 100 * 2 + 400,
        },
      ]);
    });

    it('should compute expected vs. received data for a yearly filter', async () => {
      const mockOrders = [
        {
          payment_terms: [
            {
              date: new Date('2023-01-10'),
              calculated_amount: 3000,
              status: PAYMENT_STATUS_ENUM.PENDING,
            },
            {
              date: new Date('2023-07-10'),
              payment_receive_date: new Date('2023-07-15'),
              calculated_amount: 1000,
              status: PAYMENT_STATUS_ENUM.PAID,
            },
          ],
        },
      ];
      const mockCustomizations = [
        {
          purchased_date: new Date('2023-03-01'),
          cost: 500,
          payment_receive_date: new Date('2023-03-10'),
          payment_status: PAYMENT_STATUS_ENUM.PAID,
        },
      ];
      const mockLicenses = [
        {
          purchase_date: new Date('2023-05-15'),
          rate: { amount: 200 },
          total_license: 1,
          payment_receive_date: new Date('2023-06-01'),
          payment_status: PAYMENT_STATUS_ENUM.PAID,
        },
      ];
      const mockServices = [
        {
          purchased_date: new Date('2023-02-10'),
          cost: 200,
          payment_receive_date: null,
          payment_status: PAYMENT_STATUS_ENUM.PENDING,
        },
      ];
      const mockAMCs = [
        {
          amount: 600,
          payments: [
            {},
            {
              from_date: new Date('2023-01-20'),
              status: PAYMENT_STATUS_ENUM.PAID,
            },
          ],
        },
      ];

      orderModel.find = jest.fn().mockResolvedValue(mockOrders);
      customizationModel.find = jest.fn().mockResolvedValue(mockCustomizations);
      licenseModel.find = jest.fn().mockResolvedValue(mockLicenses);
      additionalServiceModel.find = jest.fn().mockResolvedValue(mockServices);
      amcModel.find = jest.fn().mockResolvedValue(mockAMCs);

      const result = await service.getExpectedVsReceivedChartData('yearly', {
        year: 2023,
      });

      expect(result).toEqual([
        {
          period: '2023',
          expected_amount: 3000 + 1000 + 500 + 200 * 1 + 200 + 600,
          received_amount: 1000 + 500 + 200 + 600,
        },
      ]);
    });

    it('should handle empty data correctly', async () => {
      orderModel.find = jest.fn().mockResolvedValue([]);
      customizationModel.find = jest.fn().mockResolvedValue([]);
      licenseModel.find = jest.fn().mockResolvedValue([]);
      additionalServiceModel.find = jest.fn().mockResolvedValue([]);
      amcModel.find = jest.fn().mockResolvedValue([]);

      const result = await service.getExpectedVsReceivedChartData('monthly', {
        month: 6,
        year: 2023,
      });

      expect(result).toEqual([]);
    });

    it('should ignore data outside the specified range', async () => {
      const mockOrders = [
        {
          payment_terms: [
            {
              date: new Date('2022-06-15'),
              calculated_amount: 1000,
              status: undefined,
            },
          ],
        },
      ];
      orderModel.find = jest.fn().mockResolvedValue(mockOrders);
      customizationModel.find = jest.fn().mockResolvedValue([]);
      licenseModel.find = jest.fn().mockResolvedValue([]);
      additionalServiceModel.find = jest.fn().mockResolvedValue([]);
      amcModel.find = jest.fn().mockResolvedValue([]);

      const result = await service.getExpectedVsReceivedChartData('monthly', {
        month: 6,
        year: 2023,
      });

      expect(result).toEqual([]);
    });
  });
});
