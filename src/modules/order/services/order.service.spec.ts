import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { getModelToken } from '@nestjs/mongoose';
import { LoggerService } from '@/common/logger/services/logger.service';
import { StorageService } from '@/common/storage/services/storage.service';
import {
  AMC,
  AMCDocument,
  PAYMENT_STATUS_ENUM,
} from '@/db/schema/amc/amc.schema';
import { Model } from 'mongoose';

describe('OrderService', () => {
  let service: OrderService;
  let amcModel: Model<AMCDocument>;
  let loggerService: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getModelToken('Order'), useValue: {} },
        { provide: getModelToken('License'), useValue: {} },
        { provide: getModelToken('Customization'), useValue: {} },
        { provide: getModelToken('Product'), useValue: {} },
        { provide: getModelToken('Client'), useValue: {} },
        { provide: getModelToken('AdditionalService'), useValue: {} },
        {
          provide: getModelToken('AMC'),
          useValue: { find: jest.fn(), findByIdAndUpdate: jest.fn() },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), error: jest.fn() },
        },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    amcModel = module.get<Model<AMCDocument>>(getModelToken('AMC'));
    loggerService = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

describe('updateAMCPayments - with multiple payments', () => {
    const mockAmcs = [
      {
        _id: 'amc1',
        payments: [
          {
            from_date: new Date('2024-12-03T00:00:00.000Z'),
            to_date: new Date('2025-12-03T00:00:00.000Z'),
            status: PAYMENT_STATUS_ENUM.PAID,
          },
          {
            from_date: new Date('2025-12-03T00:00:00.000Z'),
            to_date: new Date('2026-12-03T00:00:00.000Z'),
            status: PAYMENT_STATUS_ENUM.PAID,
          },
        ],
        amc_frequency_in_months: 12,
      },
    ];

    beforeEach(() => {
      jest.spyOn(amcModel, 'find').mockResolvedValue(mockAmcs as any);
      jest.spyOn(amcModel, 'findByIdAndUpdate').mockResolvedValue(null);
      jest.spyOn(loggerService, 'log').mockImplementation();
      jest.spyOn(loggerService, 'error').mockImplementation();
    });

    afterEach(() => {
      jest.clearAllMocks();
      jest.restoreAllMocks();
    });

    it('should not create a new payment when today is before the last payment to_date', async () => {
      jest
        .spyOn(Date, 'now')
        .mockReturnValue(new Date('2025-11-30T00:00:00.000Z').getTime());

      const result = await service.updateAMCPayments();

      expect(amcModel.find).toHaveBeenCalledWith({
        payments: { $exists: true, $ne: [] },
        amc_frequency_in_months: { $exists: true },
      });
      expect(amcModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(result).toEqual({
        processed: 1,
        updated: 0,
        skipped: 1,
        errors: 0
      });
    });

    it('should create a new payment when today is after the last payment to_date', async () => {
      const mockAmcs = [
        {
          _id: 'amc1',
          payments: [
            {
              from_date: new Date('2024-12-03T00:00:00.000Z'),
              to_date: new Date('2026-12-03T00:00:00.000Z'),
              status: PAYMENT_STATUS_ENUM.PAID,
            },
          ],
          amc_frequency_in_months: 12,
        },
      ];

      jest.spyOn(amcModel, 'find').mockResolvedValue(mockAmcs as any);
      const mockUpdate = jest.spyOn(amcModel, 'findByIdAndUpdate');

      jest
        .spyOn(Date, 'now')
        .mockReturnValue(new Date('2027-01-01T00:00:00.000Z').getTime());

      const result = await service.updateAMCPayments();

      expect(amcModel.find).toHaveBeenCalledWith({
        payments: { $exists: true, $ne: [] },
        amc_frequency_in_months: { $exists: true },
      });
      expect(mockUpdate).toHaveBeenCalledWith('amc1', {
        $push: {
          payments: {
            from_date: new Date('2026-12-03T00:00:00.000Z'),
            to_date: new Date('2027-12-03T00:00:00.000Z'),
            status: PAYMENT_STATUS_ENUM.PENDING,
          },
        },
      });
      expect(result).toEqual({
        processed: 1,
        updated: 1,
        skipped: 0,
        errors: 0
      });
    });

    it('should handle empty payments array', async () => {
      const mockAmcsEmpty = [
        {
          _id: 'amc1',
          payments: [],
          amc_frequency_in_months: 12,
        },
      ];

      jest.spyOn(amcModel, 'find').mockResolvedValue(mockAmcsEmpty as any);

      const result = await service.updateAMCPayments();

      expect(amcModel.find).toHaveBeenCalledWith({
        payments: { $exists: true, $ne: [] },
        amc_frequency_in_months: { $exists: true },
      });
      expect(amcModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(result).toEqual({
        processed: 1,
        updated: 0,
        skipped: 0,
        errors: 0
      });
    });

    it('should handle error during AMC update', async () => {
      const mockError = new Error('Database error');
      jest.spyOn(amcModel, 'findByIdAndUpdate').mockRejectedValue(mockError);

      const result = await service.updateAMCPayments();

      expect(result).toEqual({
        processed: 1,
        updated: 0,
        skipped: 0,
        errors: 1
      });
      expect(loggerService.error).toHaveBeenCalled();
    });
  });
});
