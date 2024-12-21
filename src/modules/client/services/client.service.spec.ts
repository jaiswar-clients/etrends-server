import { Test, TestingModule } from '@nestjs/testing';
import { ClientService } from './client.service';
import { getModelToken } from '@nestjs/mongoose';
import { LoggerService } from '@/common/logger/services/logger.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/amc/amc.schema';

describe('ClientService', () => {
  let service: ClientService;
  let clientModel;
  let orderModel;
  let loggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientService,
        {
          provide: getModelToken('Client'),
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: getModelToken('Order'),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ClientService>(ClientService);
    clientModel = module.get(getModelToken('Client'));
    orderModel = module.get(getModelToken('Order'));
    loggerService = module.get<LoggerService>(LoggerService);
  });

  describe('getProfitFromClient', () => {
    const mockClientId = 'client123';

    it('should calculate profits for client with multiple orders including recurring AMC payments', async () => {
      const mockClient = {
        _id: mockClientId,
        orders: ['order1', 'order2', 'order3', 'order4'],
      };

      const mockOrders = [
        {
          _id: 'order1',
          base_cost: 5000,
          customizations: [{ cost: 1000 }, { cost: 2000 }],
          licenses: [
            { total_license: 5, rate: { amount: 500 } },
            { total_license: 2, rate: { amount: 1000 } },
          ],
          additional_services: [{ cost: 1500 }],
          amc_id: {
            payments: [
              { status: PAYMENT_STATUS_ENUM.PAID }, // Free first payment
              { status: PAYMENT_STATUS_ENUM.PAID },
              { status: PAYMENT_STATUS_ENUM.PAID },
              { status: PAYMENT_STATUS_ENUM.PAID },
            ],
            amount: 2000,
            total_cost: 3000,
          },
          products: [{ name: 'Product 1', short_name: 'P1' }],
        },
        {
          _id: 'order2',
          base_cost: 3000,
          customizations: [{ cost: 1500 }],
          licenses: [{ total_license: 3, rate: { amount: 800 } }],
          additional_services: [{ cost: 2000 }, { cost: 1000 }],
          amc_id: {
            payments: [
              { status: PAYMENT_STATUS_ENUM.PAID },
              { status: PAYMENT_STATUS_ENUM.PAID },
              { status: PAYMENT_STATUS_ENUM.PENDING },
            ],
            amount: 1500,
            total_cost: 2500,
          },
          products: [{ name: 'Product 2', short_name: 'P2' }],
        },
        {
          _id: 'order3',
          base_cost: 4000,
          customizations: [],
          licenses: [{ total_license: 1, rate: { amount: 3000 } }],
          additional_services: [],
          amc_id: {
            payments: [{ status: PAYMENT_STATUS_ENUM.PAID }],
            amount: 1000,
            total_cost: 1500,
          },
          products: [{ name: 'Product 3', short_name: 'P3' }],
        },
        {
          _id: 'order4',
          base_cost: 6000,
          customizations: [{ cost: 2500 }, { cost: 1500 }],
          licenses: [],
          additional_services: [{ cost: 3000 }],
          amc_id: {
            payments: [
              { status: PAYMENT_STATUS_ENUM.PAID },
              { status: PAYMENT_STATUS_ENUM.PAID },
              { status: PAYMENT_STATUS_ENUM.PAID },
            ],
            amount: 2500,
            total_cost: 4000,
          },
          products: [{ name: 'Product 4', short_name: 'P4' }],
        },
      ];

      clientModel.findById.mockResolvedValue(mockClient);
      orderModel.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrders),
      });

      const result = await service.getProfitFromClient(mockClientId);

      // Calculate expected profits
      const order1Total = 5000 + 3000 + 4500 + 1500; // base + customizations + licenses + additional
      const order2Total = 3000 + 1500 + 2400 + 3000;
      const order3Total = 4000 + 0 + 3000 + 0;
      const order4Total = 6000 + 4000 + 0 + 3000;
      const expectedTotalProfit =
        order1Total + order2Total + order3Total + order4Total;

      // Calculate AMC collections
      // Order1: 3 paid AMCs after first free payment = 6000
      // Order2: 1 paid AMC after first free payment = 1500
      // Order3: No paid AMCs after first free payment = 0
      // Order4: 2 paid AMCs after first free payment = 5000
      const expectedAmcCollected = 3 * 2000 + 1 * 1500 + 2 * 2500;

      expect(result).toMatchObject({
        total_profit: expectedTotalProfit,
        upcoming_amc_profit: 0,
        total_amc_collected: expectedAmcCollected,
        currency: 'INR',
      });

      expect(result.orders).toHaveLength(4);
      expect(result.orders.map((o) => o.id)).toEqual([
        'order1',
        'order2',
        'order3',
        'order4',
      ]);

      // Verify order details are properly formatted
      result.orders.forEach((order) => {
        expect(order).toHaveProperty('products');
        expect(order).toHaveProperty('base_cost');
        expect(order).toHaveProperty('customizations');
        expect(order).toHaveProperty('licenses');
        expect(order).toHaveProperty('additional_services');
        expect(order).toHaveProperty('amc_details');
        expect(order).toHaveProperty('agreements');
        expect(order).toHaveProperty('status');
        expect(order).toHaveProperty('purchased_date');
      });
    });

    it('should handle client with no orders', async () => {
      const mockClient = {
        _id: mockClientId,
        orders: [],
      };

      clientModel.findById.mockResolvedValue(mockClient);
      orderModel.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getProfitFromClient(mockClientId);

      expect(result).toMatchObject({
        total_profit: 0,
        upcoming_amc_profit: 0,
        total_amc_collected: 0,
        currency: 'INR',
        orders: [],
      });
    });

    it('should handle orders with null/undefined cost values', async () => {
      const mockClient = {
        _id: mockClientId,
        orders: ['order1'],
      };

      const mockOrders = [
        {
          _id: 'order1',
          base_cost: null,
          customizations: [{ cost: undefined }, { cost: null }],
          licenses: [
            { total_license: null, rate: { amount: 100 } },
            { total_license: 2, rate: { amount: undefined } },
          ],
          additional_services: [{ cost: null }],
          amc_id: {
            payments: [],
            amount: null,
          },
          products: [],
        },
      ];

      clientModel.findById.mockResolvedValue(mockClient);
      orderModel.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrders),
      });

      const result = await service.getProfitFromClient(mockClientId);

      expect(result).toMatchObject({
        total_profit: 0,
        upcoming_amc_profit: 0,
        total_amc_collected: 0,
        currency: 'INR',
      });
    });
  });
});
