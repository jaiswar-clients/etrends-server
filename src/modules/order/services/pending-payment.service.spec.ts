import { Test, TestingModule } from '@nestjs/testing';
import {
  PendingPaymentService,
  PendingPaymentRow,
} from './pending-payment.service';
import { getModelToken } from '@nestjs/mongoose';
import { LoggerService } from '@/common/logger/services/logger.service';
import { Types } from 'mongoose';
import { PAYMENT_STATUS_ENUM } from '@/common/types/enums/order.enum';

describe('PendingPaymentService', () => {
  let service: PendingPaymentService;
  let orderModel: any;
  let amcModel: any;
  let licenseModel: any;
  let customizationModel: any;
  let clientModel: any;
  let productModel: any;

  const createMockModel = () => ({
    find: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findByIdAndUpdate: jest.fn().mockResolvedValue(null),
    findOne: jest.fn().mockReturnThis(),
    aggregate: jest.fn().mockResolvedValue([]),
    distinct: jest.fn().mockResolvedValue([]),
    countDocuments: jest.fn().mockResolvedValue(0),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    select: jest.fn().mockReturnThis(),
    updateOne: jest.fn().mockResolvedValue({}),
  });

  beforeEach(async () => {
    orderModel = createMockModel();
    amcModel = createMockModel();
    licenseModel = createMockModel();
    customizationModel = createMockModel();
    clientModel = createMockModel();
    productModel = createMockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PendingPaymentService,
        { provide: getModelToken('Order'), useValue: orderModel },
        { provide: getModelToken('AMC'), useValue: amcModel },
        { provide: getModelToken('License'), useValue: licenseModel },
        { provide: getModelToken('Customization'), useValue: customizationModel },
        {
          provide: getModelToken('AdditionalService'),
          useValue: createMockModel(),
        },
        { provide: getModelToken('Client'), useValue: clientModel },
        { provide: getModelToken('Product'), useValue: productModel },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PendingPaymentService>(PendingPaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPendingPayments', () => {
    it('excludes proforma payment_terms', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.aggregate.mockResolvedValue([
        {
          _id: orderId,
          termIndex: 1,
          payment_terms: {
            status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: '2026-03-15T00:00:00.000Z',
            invoice_number: 'INV-1',
            calculated_amount: 5000,
          },
          base_cost: 100000,
          client: [{ name: 'Client A' }],
          productDetails: [{ short_name: 'Prod A' }],
        },
      ]);

      const result = await service.getPendingPayments({ page: 1, limit: 20 });

      const orderRows = result.pending_payments.filter(
        (r: PendingPaymentRow) => r.type === 'order',
      );
      expect(orderRows).toHaveLength(1);
      expect(orderRows[0].pending_amount).toBe(5000);
      expect(orderRows[0].status).toBe(PAYMENT_STATUS_ENUM.PENDING);
    });

    it('excludes pending payment_terms with no invoice_date (Titan bug)', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.aggregate.mockResolvedValue([]);

      const result = await service.getPendingPayments({ page: 1, limit: 20 });

      expect(result.pending_payments).toHaveLength(0);
    });

    it('includes license and customization when type=all', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.aggregate.mockResolvedValue([]);
      amcModel.aggregate.mockResolvedValue([]);
      orderModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: orderId.toString(),
              client_id: { name: 'License Client' },
            },
          ]),
        }),
        distinct: jest.fn().mockResolvedValue([orderId]),
      });
      productModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: new Types.ObjectId(), short_name: 'License Prod' },
            { _id: new Types.ObjectId(), short_name: 'Cust Prod' },
          ]),
        }),
      });

      licenseModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            order_id: orderId.toString(),
            product_id: new Types.ObjectId(),
            payment_status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: new Date('2026-03-15'),
            cost: 12000,
            invoice_number: 'INV-L1',
          },
        ]),
      });

      customizationModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            order_id: orderId.toString(),
            product_id: new Types.ObjectId(),
            payment_status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: new Date('2026-03-15'),
            cost: 8000,
            invoice_number: 'INV-C1',
          },
        ]),
      });

      const result = await service.getPendingPayments({
        page: 1,
        limit: 20,
        type: 'all',
      });

      const types = result.pending_payments.map(
        (r: PendingPaymentRow) => r.type,
      );
      expect(types).toContain('license');
      expect(types).toContain('customization');
    });

    it('filters by invoice_date month range', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.aggregate.mockImplementation((pipeline: any[]) => {
        const matchStage = pipeline.find(
          (s) => s.$match && s.$match['payment_terms.invoice_date'],
        );
        if (matchStage) {
          return Promise.resolve([
            {
              _id: orderId,
              termIndex: 0,
              payment_terms: {
                status: PAYMENT_STATUS_ENUM.PENDING,
                invoice_date: '2026-03-15T00:00:00.000Z',
                invoice_number: 'INV-MAR',
                calculated_amount: 3000,
              },
              base_cost: 50000,
              client: [{ name: 'Client' }],
              productDetails: [{ short_name: 'Prod' }],
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getPendingPayments({
        page: 1,
        limit: 20,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      });

      expect(result.pending_payments).toHaveLength(1);
      expect(
        result.pending_payments[0].invoice_date?.toISOString(),
      ).toBe('2026-03-15T00:00:00.000Z');
    });

    it('computes balance fraction = pending / order_total', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.aggregate.mockResolvedValue([
        {
          _id: orderId,
          termIndex: 0,
          payment_terms: {
            status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: '2026-03-15T00:00:00.000Z',
            invoice_number: 'INV-1',
            calculated_amount: 25000,
          },
          base_cost: 100000,
          client: [{ name: 'Client' }],
          productDetails: [{ short_name: 'Prod' }],
        },
      ]);

      const result = await service.getPendingPayments({ page: 1, limit: 20 });

      expect(result.pending_payments).toHaveLength(1);
      expect(result.pending_payments[0].balance).toBeCloseTo(0.25, 5);
    });
  });

  describe('getAmcStartMissing', () => {
    it('returns orders where amc_start_date is null/missing', async () => {
      const activeOrderId = new Types.ObjectId();
      orderModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                  {
                    _id: activeOrderId,
                    client_id: { name: 'No-AMC Client' },
                    products: [{ short_name: 'Prod X' }],
                    purchased_date: new Date('2026-01-15'),
                    base_cost: 50000,
                    pending_balance: 25000,
                  },
                ]),
              }),
            }),
          }),
        }),
      });
      orderModel.countDocuments.mockResolvedValue(1);

      const res = await service.getAmcStartMissing({ page: 1, limit: 20 });
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].order_id).toBe(activeOrderId.toString());
      expect(res.rows[0].client_name).toBe('No-AMC Client');
    });
  });

  describe('updatePendingPaymentStatus', () => {
    it('decrements order pending_balance when a payment_term marked PAID', async () => {
      const orderId = new Types.ObjectId().toString();
      const termIndex = '0';
      orderModel.findByIdAndUpdate = jest.fn().mockResolvedValue({
        _id: orderId,
        payment_terms: [
          { status: PAYMENT_STATUS_ENUM.PENDING, calculated_amount: 3000 },
        ],
      });
      orderModel.updateOne = jest.fn().mockResolvedValue({});

      await service.updatePendingPaymentStatus(
        orderId,
        'order',
        `${orderId}::${termIndex}`,
        { status: PAYMENT_STATUS_ENUM.PAID, payment_receive_date: new Date() },
      );

      expect(orderModel.updateOne).toHaveBeenCalledWith(
        { _id: orderId },
        { $inc: { pending_balance: -3000, total_paid: 3000 } },
      );
    });

    it('does not double-decrement when term was already PAID', async () => {
      const orderId = new Types.ObjectId().toString();
      orderModel.findByIdAndUpdate = jest.fn().mockResolvedValue({
        _id: orderId,
        payment_terms: [
          { status: PAYMENT_STATUS_ENUM.PAID, calculated_amount: 3000 },
        ],
      });
      orderModel.updateOne = jest.fn().mockResolvedValue({});

      await service.updatePendingPaymentStatus(
        orderId,
        'order',
        `${orderId}::0`,
        { status: PAYMENT_STATUS_ENUM.PAID, payment_receive_date: new Date() },
      );

      expect(orderModel.updateOne).not.toHaveBeenCalled();
    });

    it('does not adjust balance when status is not PAID', async () => {
      const orderId = new Types.ObjectId().toString();
      orderModel.findByIdAndUpdate = jest.fn().mockResolvedValue({ _id: orderId });

      await service.updatePendingPaymentStatus(
        orderId,
        'order',
        `${orderId}::0`,
        { status: PAYMENT_STATUS_ENUM.PENDING, payment_receive_date: new Date() },
      );

      expect(orderModel.findById).not.toHaveBeenCalled();
      expect(orderModel.updateOne).not.toHaveBeenCalled();
    });

    it('throws when payment type is invalid', async () => {
      const id = new Types.ObjectId().toString();
      await expect(
        service.updatePendingPaymentStatus(id, 'invalid' as any, id, {
          status: PAYMENT_STATUS_ENUM.PAID,
          payment_receive_date: new Date(),
        }),
      ).rejects.toThrow('Invalid payment type');
    });

    it('throws when payment is not found', async () => {
      const id = new Types.ObjectId().toString();
      orderModel.findByIdAndUpdate = jest.fn().mockResolvedValue(null);

      await expect(
        service.updatePendingPaymentStatus(id, 'order', `${id}::0`, {
          status: PAYMENT_STATUS_ENUM.PAID,
          payment_receive_date: new Date(),
        }),
      ).rejects.toThrow('Payment not found');
    });

    it('updates license status without balance adjustment', async () => {
      const id = new Types.ObjectId().toString();
      licenseModel.findByIdAndUpdate = jest.fn().mockResolvedValue({ _id: id });

      await service.updatePendingPaymentStatus(id, 'license', id, {
        status: PAYMENT_STATUS_ENUM.PAID,
        payment_receive_date: new Date(),
      });

      expect(licenseModel.findByIdAndUpdate).toHaveBeenCalledWith(id, {
        payment_status: PAYMENT_STATUS_ENUM.PAID,
        payment_receive_date: expect.any(Date),
      });
    });

    it('updates customization status without balance adjustment', async () => {
      const id = new Types.ObjectId().toString();
      customizationModel.findByIdAndUpdate = jest.fn().mockResolvedValue({ _id: id });

      await service.updatePendingPaymentStatus(id, 'customization', id, {
        status: PAYMENT_STATUS_ENUM.PAID,
        payment_receive_date: new Date(),
      });

      expect(customizationModel.findByIdAndUpdate).toHaveBeenCalledWith(id, {
        payment_status: PAYMENT_STATUS_ENUM.PAID,
        payment_receive_date: expect.any(Date),
      });
    });

    it('updates AMC payment status by index', async () => {
      const id = new Types.ObjectId().toString();
      amcModel.findByIdAndUpdate = jest.fn().mockResolvedValue({ _id: id });

      await service.updatePendingPaymentStatus(id, 'amc', `${id}::2`, {
        status: PAYMENT_STATUS_ENUM.PAID,
        payment_receive_date: new Date(),
      });

      expect(amcModel.findByIdAndUpdate).toHaveBeenCalledWith(id, {
        'payments.2.status': PAYMENT_STATUS_ENUM.PAID,
        'payments.2.payment_receive_date': expect.any(Date),
      });
    });
  });

  describe('getPendingPayments pagination', () => {
    it('returns page 2 of results', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.aggregate.mockResolvedValue([
        {
          _id: orderId,
          termIndex: 0,
          payment_terms: {
            status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: '2026-03-15T00:00:00.000Z',
            invoice_number: 'INV-1',
            calculated_amount: 1000,
          },
          base_cost: 10000,
          client: [{ name: 'Client' }],
          productDetails: [{ short_name: 'Prod' }],
        },
        {
          _id: orderId,
          termIndex: 1,
          payment_terms: {
            status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: '2026-03-20T00:00:00.000Z',
            invoice_number: 'INV-2',
            calculated_amount: 2000,
          },
          base_cost: 10000,
          client: [{ name: 'Client' }],
          productDetails: [{ short_name: 'Prod' }],
        },
      ]);

      const result = await service.getPendingPayments({ page: 1, limit: 1 });
      expect(result.pending_payments).toHaveLength(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);

      const page2 = await service.getPendingPayments({ page: 2, limit: 1 });
      expect(page2.pending_payments).toHaveLength(1);
      expect(page2.pending_payments[0].pending_amount).toBe(1000);
      expect(page2.pagination.hasPreviousPage).toBe(true);
    });

    it('returns empty pagination when no results', async () => {
      orderModel.distinct.mockResolvedValue([]);

      const result = await service.getPendingPayments({ page: 1, limit: 20 });

      expect(result.pending_payments).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });
  });

  describe('getPendingPayments type filtering', () => {
    it('returns only order rows when type=order', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.aggregate.mockResolvedValue([
        {
          _id: orderId,
          termIndex: 0,
          payment_terms: {
            status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: '2026-03-15T00:00:00.000Z',
            invoice_number: 'INV-1',
            calculated_amount: 5000,
          },
          base_cost: 100000,
          client: [{ name: 'Client A' }],
          productDetails: [{ short_name: 'Prod A' }],
        },
      ]);
      amcModel.aggregate.mockResolvedValue([]);

      const result = await service.getPendingPayments({
        page: 1,
        limit: 20,
        type: 'order',
      });

      const types = result.pending_payments.map((r: PendingPaymentRow) => r.type);
      expect(types).toEqual(['order']);
      expect(amcModel.aggregate).not.toHaveBeenCalled();
    });

    it('returns only amc rows when type=amc', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.aggregate.mockResolvedValue([]);
      amcModel.aggregate.mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          paymentIndex: 0,
          payments: {
            status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: new Date('2026-03-15'),
            invoice_number: 'INV-AMC-1',
            amc_rate_amount: 5000,
          },
          client: [{ name: 'AMC Client' }],
          productDetails: [{ short_name: 'AMC Prod' }],
          amount: 50000,
        },
      ]);

      const result = await service.getPendingPayments({
        page: 1,
        limit: 20,
        type: 'amc',
      });

      const types = result.pending_payments.map((r: PendingPaymentRow) => r.type);
      expect(types).toEqual(['amc']);
      expect(orderModel.aggregate).not.toHaveBeenCalled();
    });

    it('returns only license rows when type=license', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: orderId.toString(), client_id: { name: 'Lic Client' } },
          ]),
        }),
        distinct: jest.fn().mockResolvedValue([orderId]),
      });
      productModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: new Types.ObjectId(), short_name: 'Lic Prod' },
          ]),
        }),
      });
      licenseModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            order_id: orderId.toString(),
            product_id: new Types.ObjectId(),
            payment_status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: new Date('2026-03-15'),
            cost: 12000,
            invoice_number: 'INV-L1',
          },
        ]),
      });

      const result = await service.getPendingPayments({
        page: 1,
        limit: 20,
        type: 'license',
      });

      const types = result.pending_payments.map((r: PendingPaymentRow) => r.type);
      expect(types).toEqual(['license']);
    });

    it('returns only customization rows when type=customization', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: orderId.toString(), client_id: { name: 'Cust Client' } },
          ]),
        }),
        distinct: jest.fn().mockResolvedValue([orderId]),
      });
      productModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: new Types.ObjectId(), short_name: 'Cust Prod' },
          ]),
        }),
      });
      customizationModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            order_id: orderId.toString(),
            product_id: new Types.ObjectId(),
            payment_status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: new Date('2026-03-15'),
            cost: 8000,
            invoice_number: 'INV-C1',
          },
        ]),
      });

      const result = await service.getPendingPayments({
        page: 1,
        limit: 20,
        type: 'customization',
      });

      const types = result.pending_payments.map((r: PendingPaymentRow) => r.type);
      expect(types).toEqual(['customization']);
    });
  });

  describe('getPendingPayments client filtering', () => {
    it('filters by clientId', async () => {
      const clientId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([]);
      clientModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: clientId }]),
        }),
      });

      const result = await service.getPendingPayments({
        page: 1,
        limit: 20,
        clientId: clientId.toString(),
      });

      expect(orderModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: clientId }),
      );
      expect(result.pending_payments).toHaveLength(0);
    });

    it('filters by clientName substring', async () => {
      orderModel.distinct.mockResolvedValue([]);
      clientModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]),
        }),
      });

      const result = await service.getPendingPayments({
        page: 1,
        limit: 20,
        clientName: 'Acme',
      });

      expect(clientModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ name: { $regex: 'Acme', $options: 'i' } }),
      );
      expect(result.pending_payments).toHaveLength(0);
    });
  });

  describe('getPendingPayments edge cases', () => {
    it('uses N/A when license has no matching order', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
        distinct: jest.fn().mockResolvedValue([orderId]),
      });
      productModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });
      licenseModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            order_id: orderId.toString(),
            product_id: new Types.ObjectId(),
            payment_status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: new Date('2026-03-15'),
            cost: 12000,
            invoice_number: 'INV-L1',
          },
        ]),
      });

      const result = await service.getPendingPayments({
        page: 1,
        limit: 20,
        type: 'license',
      });

      expect(result.pending_payments[0].client_name).toBe('N/A');
      expect(result.pending_payments[0].product_name).toBe('N/A');
    });

    it('balance is 0 when order_total is 0', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.aggregate.mockResolvedValue([
        {
          _id: orderId,
          termIndex: 0,
          payment_terms: {
            status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: '2026-03-15T00:00:00.000Z',
            invoice_number: 'INV-1',
            calculated_amount: 5000,
          },
          base_cost: 0,
          client: [{ name: 'Client' }],
          productDetails: [{ short_name: 'Prod' }],
        },
      ]);

      const result = await service.getPendingPayments({ page: 1, limit: 20 });

      expect(result.pending_payments[0].balance).toBe(0);
    });

    it('excludes proforma payment_terms explicitly', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.aggregate.mockImplementation((pipeline: any[]) => {
        const matchStage = pipeline.find(
          (s) =>
            s.$match &&
            s.$match['payment_terms.status'] === PAYMENT_STATUS_ENUM.PENDING,
        );
        expect(matchStage).toBeDefined();
        return Promise.resolve([]);
      });

      const result = await service.getPendingPayments({ page: 1, limit: 20 });

      expect(result.pending_payments).toHaveLength(0);
    });
  });

  describe('getAmcStartMissing pagination', () => {
    it('returns page 2 with skip offset', async () => {
      orderModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      orderModel.countDocuments.mockResolvedValue(50);

      const result = await service.getAmcStartMissing({ page: 2, limit: 20 });

      expect(orderModel.find).toHaveBeenCalledWith(expect.any(Object));
      expect(orderModel.find().skip).toHaveBeenCalledWith(20);
      expect(orderModel.find().skip().limit).toHaveBeenCalledWith(20);
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('filters by clientId', async () => {
      const clientId = new Types.ObjectId();
      orderModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      orderModel.countDocuments.mockResolvedValue(0);

      await service.getAmcStartMissing({
        page: 1,
        limit: 20,
        clientId: clientId.toString(),
      });

      expect(orderModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: clientId,
        }),
      );
    });
  });

  describe('exportPendingPaymentsToExcel', () => {
    it('returns a Buffer', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.aggregate.mockResolvedValue([
        {
          _id: orderId,
          termIndex: 0,
          payment_terms: {
            status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: '2026-03-15T00:00:00.000Z',
            invoice_number: 'INV-1',
            calculated_amount: 5000,
          },
          base_cost: 100000,
          client: [{ name: 'Client A' }],
          productDetails: [{ short_name: 'Prod A' }],
        },
      ]);

      const buffer = await service.exportPendingPaymentsToExcel({
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('includes all rows without pagination', async () => {
      const orderId = new Types.ObjectId();
      orderModel.distinct.mockResolvedValue([orderId]);
      orderModel.aggregate.mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => ({
          _id: orderId,
          termIndex: i,
          payment_terms: {
            status: PAYMENT_STATUS_ENUM.PENDING,
            invoice_date: '2026-03-15T00:00:00.000Z',
            invoice_number: `INV-${i}`,
            calculated_amount: 1000,
          },
          base_cost: 100000,
          client: [{ name: 'Client' }],
          productDetails: [{ short_name: 'Prod' }],
        })),
      );

      const buffer = await service.exportPendingPaymentsToExcel({});

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(orderModel.aggregate).toHaveBeenCalled();
    });
  });
});
