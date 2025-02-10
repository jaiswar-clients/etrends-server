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
    const mockOrder = {
      _id: 'order1',
      amc_start_date: new Date('2024-01-01'),
      base_cost: 10000,
      amc_rate: {
        percentage: 20,
        amount: 2000
      },
      client_id: {
        amc_frequency_in_months: 12
      },
      customizations: [
        {
          purchased_date: new Date('2024-06-01'),
          cost: 5000
        }
      ],
      licenses: [
        {
          purchase_date: new Date('2024-08-01'),
          rate: {
            amount: 1000
          },
          total_license: 2
        }
      ]
    };

    const mockAmcs = [
      {
        _id: 'amc1',
        order_id: mockOrder,
        payments: [
          {
            from_date: new Date('2024-01-01'),
            to_date: new Date('2025-01-01'),
            status: PAYMENT_STATUS_ENUM.PAID,
          }
        ]
      }
    ];

    beforeEach(() => {
      const findMock = jest.fn().mockReturnThis();
      const populateMock = jest.fn().mockReturnThis();
      
      findMock.mockReturnValue({
        populate: populateMock,
      });
      
      populateMock.mockResolvedValue(mockAmcs);
      
      jest.spyOn(amcModel, 'find').mockImplementation(findMock);
      jest.spyOn(amcModel, 'findByIdAndUpdate').mockResolvedValue(null);
      jest.spyOn(loggerService, 'log').mockImplementation();
      jest.spyOn(loggerService, 'error').mockImplementation();
    });

    afterEach(() => {
      jest.clearAllMocks();
      jest.restoreAllMocks();
    });

    it('should add new payment when current date is after last payment end date', async () => {
      // Mock current date to be after the last payment's end date
      jest
        .spyOn(Date, 'now')
        .mockReturnValue(new Date('2025-02-01').getTime());

      const result = await service.updateAMCPayments();

      // Verify AMC model was queried correctly
      expect(amcModel.find).toHaveBeenCalledWith({
        payments: { $exists: true, $ne: [] },
      });

      // Verify the update was called with correct new payment
      expect(amcModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'amc1',
        {
          $push: {
            payments: {
              from_date: new Date('2025-01-01'),
              to_date: new Date('2026-01-01'),
              status: PAYMENT_STATUS_ENUM.PENDING,
              is_free_amc: false,
              amc_frequency: 12,
              total_cost: 17000, // base_cost + customization + license costs
              amc_rate_applied: 20,
              amc_rate_amount: 3400 // 20% of 17000
            }
          },
          amount: 3400,
          total_cost: 17000
        }
      );

      expect(result).toEqual({
        processed: 1,
        updated: 1,
        skipped: 0,
        errors: 0,
      });
    });

    it('should not add new payment when current date is before last payment end date', async () => {
      // Mock current date to be before the last payment's end date
      jest
        .spyOn(Date, 'now')
        .mockReturnValue(new Date('2024-12-01').getTime());

      const result = await service.updateAMCPayments();

      expect(amcModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(result).toEqual({
        processed: 1,
        updated: 0,
        skipped: 1,
        errors: 0,
      });
    });

    it('should skip AMC if order is not found', async () => {
      const mocksWithoutOrder = [
        {
          _id: 'amc1',
          order_id: null,
          payments: [
            {
              from_date: new Date('2024-01-01'),
              to_date: new Date('2025-01-01'),
              status: PAYMENT_STATUS_ENUM.PAID,
            }
          ]
        }
      ];

      const findMock = jest.fn().mockReturnThis();
      const populateMock = jest.fn().mockReturnThis();
      
      findMock.mockReturnValue({
        populate: populateMock,
      });
      
      populateMock.mockResolvedValue(mocksWithoutOrder);
      
      jest.spyOn(amcModel, 'find').mockImplementation(findMock);

      const result = await service.updateAMCPayments();

      expect(amcModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(result).toEqual({
        processed: 1,
        updated: 0,
        skipped: 1,
        errors: 0,
      });
    });

    it('should handle error during payment calculation', async () => {
      const mockError = new Error('Calculation error');
      jest.spyOn(amcModel, 'findByIdAndUpdate').mockRejectedValue(mockError);
      
      // Set date to trigger payment addition
      jest
        .spyOn(Date, 'now')
        .mockReturnValue(new Date('2025-02-01').getTime());

      const result = await service.updateAMCPayments();

      expect(loggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing individual AMC')
      );
      expect(result).toEqual({
        processed: 1,
        updated: 0,
        skipped: 0,
        errors: 1,
      });
    });

    it('should calculate correct amount with no additional purchases', async () => {
      const mockOrderWithoutAdditions = {
        ...mockOrder,
        customizations: [],
        licenses: []
      };

      const mocksWithoutAdditions = [
        {
          _id: 'amc1',
          order_id: mockOrderWithoutAdditions,
          payments: [
            {
              from_date: new Date('2024-01-01'),
              to_date: new Date('2025-01-01'),
              status: PAYMENT_STATUS_ENUM.PAID,
            }
          ]
        }
      ];

      const findMock = jest.fn().mockReturnThis();
      const populateMock = jest.fn().mockReturnThis();
      
      findMock.mockReturnValue({
        populate: populateMock,
      });
      
      populateMock.mockResolvedValue(mocksWithoutAdditions);
      
      jest.spyOn(amcModel, 'find').mockImplementation(findMock);
      jest
        .spyOn(Date, 'now')
        .mockReturnValue(new Date('2025-02-01').getTime());

      const result = await service.updateAMCPayments();

      expect(amcModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'amc1',
        {
          $push: {
            payments: {
              from_date: new Date('2025-01-01'),
              to_date: new Date('2026-01-01'),
              status: PAYMENT_STATUS_ENUM.PENDING,
              is_free_amc: false,
              amc_frequency: 12,
              total_cost: 10000, // Only base cost
              amc_rate_applied: 20,
              amc_rate_amount: 2000 // 20% of 10000
            }
          },
          amount: 2000,
          total_cost: 10000
        }
      );

      expect(result).toEqual({
        processed: 1,
        updated: 1,
        skipped: 0,
        errors: 0,
      });
    });
  });
});
