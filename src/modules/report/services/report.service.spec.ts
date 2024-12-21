import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';
import { getModelToken } from '@nestjs/mongoose';
import { LoggerService } from '@/common/logger/services/logger.service';
import { Model } from 'mongoose';
import {
  AMC,
  AMCDocument,
  PAYMENT_STATUS_ENUM,
} from '@/db/schema/amc/amc.schema';

describe('ReportService', () => {
  let service: ReportService;
  let amcModel: Model<AMCDocument>;
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
    loggerService = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAMCRevenueReport', () => {
    const mockAmcs = [
      {
        _id: 'amc1',
        amount: 1000,
        payments: [
          {
            from_date: new Date('2023-01-01T00:00:00Z'),
            to_date: new Date('2024-01-01T00:00:00Z'),
            status: PAYMENT_STATUS_ENUM.PAID,
          },
          {
            from_date: new Date('2024-01-01T00:00:00Z'),
            to_date: new Date('2025-01-01T00:00:00Z'),
            status: PAYMENT_STATUS_ENUM.PAID,
          },
        ],
      },
      {
        _id: 'amc2',
        amount: 1500,
        payments: [
          {
            from_date: new Date('2023-02-01T00:00:00Z'),
            to_date: new Date('2024-02-01T00:00:00Z'),
            status: PAYMENT_STATUS_ENUM.PAID,
          },
          {
            from_date: new Date('2024-02-01T00:00:00Z'),
            to_date: new Date('2025-02-01T00:00:00Z'),
            status: PAYMENT_STATUS_ENUM.PAID,
          },
        ],
      },
      {
        _id: 'amc3',
        amount: 2000,
        payments: [
          {
            from_date: new Date('2023-03-01T00:00:00Z'),
            to_date: new Date('2024-03-01T00:00:00Z'),
            status: PAYMENT_STATUS_ENUM.PENDING,
          },
          {
            from_date: new Date('2024-03-01T00:00:00Z'),
            to_date: new Date('2025-03-01T00:00:00Z'),
            status: PAYMENT_STATUS_ENUM.PAID,
          },
        ],
      },
    ];

    beforeEach(() => {
      jest.spyOn(amcModel, 'find').mockResolvedValue(mockAmcs as any);
    });

    it('should calculate AMC revenue for monthly filter', async () => {
      const filter = 'monthly';
      const options = {
        
      };

      const result = await service.getAMCRevenueReport(filter, options);

      expect(amcModel.find).toHaveBeenCalled();
      expect(result).toEqual([
        { period: 'January 2024', total: 1000 },
        { period: 'February 2024', total: 1500 },
        { period: 'March 2024', total: 2000 },
      ]);
    });

    it('should calculate AMC revenue for yearly filter', async () => {
      const filter = 'yearly';
      const options = { year: 2024 };

      const result = await service.getAMCRevenueReport(filter, options);

      expect(amcModel.find).toHaveBeenCalled();
      expect(result).toEqual([{ period: '2024', total: 4500 }]);
    });

    it('should calculate AMC revenue for quarterly filter', async () => {
      const filter = 'quarterly';
      const options = { quarter: 'Q1 2024', year: 2024 };

      const result = await service.getAMCRevenueReport(filter, options);

      expect(amcModel.find).toHaveBeenCalled();
      expect(result).toEqual([{ period: 'Q1 2024', total: 4500 }]);
    });

    it('should calculate AMC revenue for all filter', async () => {
      const filter = 'all';

      const result = await service.getAMCRevenueReport(filter);

      expect(amcModel.find).toHaveBeenCalled();
      expect(result).toEqual([{ period: 'All Time', total: 4500 }]);
    });

    it('should handle empty payments array', async () => {
      jest.spyOn(amcModel, 'find').mockResolvedValue([
        {
          _id: 'amc4',
          amount: 0,
          payments: [],
        },
      ] as any);

      const filter = 'all';

      const result = await service.getAMCRevenueReport(filter);

      expect(amcModel.find).toHaveBeenCalled();
      expect(result).toEqual([{ period: 'All Time', total: 0 }]);
    });

    it('should handle error during AMC retrieval', async () => {
      jest
        .spyOn(amcModel, 'find')
        .mockRejectedValue(new Error('Database error'));

      await expect(service.getAMCRevenueReport('all')).rejects.toThrow(
        'Internal Server Error',
      );
      expect(loggerService.error).toHaveBeenCalled();
    });
  });
});
