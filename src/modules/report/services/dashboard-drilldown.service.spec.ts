import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DashboardDrilldownService } from './dashboard-drilldown.service';
import { RevenueCalculatorService } from './revenue-calculator.service';

// Minimal chainable query mock: find().select().populate().lean()
const chain = (data: any[]) => {
  const c: any = {
    select: () => c,
    populate: () => c,
    lean: () => Promise.resolve(data),
  };
  return c;
};

describe('DashboardDrilldownService', () => {
  const clientA = new Types.ObjectId();
  const clientB = new Types.ObjectId();
  const productId = new Types.ObjectId();
  const parentOrderId = new Types.ObjectId();

  const orders = [
    {
      _id: new Types.ObjectId(),
      client_id: clientA,
      products: [String(productId)],
      payment_terms: [
        {
          name: 'Advance',
          invoice_date: '2023-05-10T00:00:00.000Z',
          calculated_amount: 3000,
          status: 'paid',
          invoice_number: 'INV-1',
          payment_receive_date: new Date('2023-06-01'),
        },
        {
          name: 'Delivery',
          invoice_date: '2023-06-15T00:00:00.000Z',
          calculated_amount: 2000,
          status: 'invoice',
          invoice_number: 'INV-2',
        },
        {
          name: 'Go-live',
          invoice_date: '2023-07-15T00:00:00.000Z',
          calculated_amount: 1000,
          status: 'to_be_created',
        },
      ],
    },
    {
      // not invoiced yet: no invoice_date, placed by purchased_date (PO date)
      _id: new Types.ObjectId(),
      client_id: clientB,
      products: [String(productId)],
      purchased_date: new Date('2023-11-05'),
      payment_terms: [
        {
          name: 'Undated TBC',
          calculated_amount: 800,
          status: 'to_be_created',
        },
        // paid rows never fall back to the PO date
        { name: 'Undated paid', calculated_amount: 999, status: 'paid' },
      ],
    },
  ];
  const customizations = [
    {
      _id: new Types.ObjectId(),
      order_id: parentOrderId,
      product_id: productId,
      title: 'Report X',
      cost: 500,
      payment_status: 'proforma',
      invoice_date: new Date('2023-08-01'),
    },
  ];
  const amcs = [
    {
      _id: new Types.ObjectId(),
      client_id: clientB,
      order_id: {
        _id: new Types.ObjectId(),
        amc_start_date: new Date('2023-04-01'),
        status: 'active',
        products: [productId],
      },
      products: [productId],
      payments: [
        {
          from_date: new Date('2023-04-01'),
          to_date: new Date('2024-03-31'),
          amc_rate_amount: 1200,
          status: 'paid',
          received_date: new Date('2023-04-20'),
          invoice_date: new Date('2023-04-05'),
        },
        {
          from_date: new Date('2023-10-01'),
          to_date: new Date('2024-09-30'),
          amc_rate_amount: 400,
          status: 'proforma',
          proforma_date: new Date('2023-09-25'),
        },
        {
          from_date: new Date('2024-04-01'),
          to_date: new Date('2025-03-31'),
          amc_rate_amount: 1300,
          status: 'to_be_created',
        },
      ],
    },
    {
      // no amc_start_date: excluded from revenue cards, still in collection cards
      _id: new Types.ObjectId(),
      client_id: clientB,
      order_id: { _id: new Types.ObjectId(), status: 'active' },
      payments: [
        {
          from_date: new Date('2023-09-01'),
          to_date: new Date('2024-08-31'),
          amc_rate_amount: 700,
          status: 'invoice',
          invoice_date: new Date('2023-09-02'),
        },
      ],
    },
    {
      // inactive order: excluded everywhere
      _id: new Types.ObjectId(),
      client_id: clientB,
      order_id: {
        _id: new Types.ObjectId(),
        amc_start_date: new Date('2023-04-01'),
        status: 'inactive',
      },
      payments: [
        {
          from_date: new Date('2023-05-01'),
          amc_rate_amount: 9999,
          status: 'paid',
        },
      ],
    },
  ];

  let service: DashboardDrilldownService;

  beforeEach(() => {
    const orderModel = {
      find: jest.fn((q: any) =>
        chain(q?._id ? [{ _id: parentOrderId, client_id: clientA }] : orders),
      ),
    };
    const empty = { find: jest.fn(() => chain([])) };
    const customizationModel = { find: jest.fn(() => chain(customizations)) };
    const productModel = {
      find: jest.fn(() => chain([{ _id: productId, name: 'Laser Audit' }])),
    };
    const clientModel = {
      find: jest.fn(() =>
        chain([
          { _id: clientA, name: 'Acme' },
          { _id: clientB, name: 'Beta' },
        ]),
      ),
    };
    const amcModel = { findWithDeleted: jest.fn(() => chain(amcs)) };
    const models = [
      orderModel,
      empty,
      customizationModel,
      empty,
      productModel,
      clientModel,
      amcModel,
    ] as any[];
    const calc = new (RevenueCalculatorService as any)(...models);
    service = new (DashboardDrilldownService as any)(...models, calc);
  });

  const total = (rows: any[]) => rows.reduce((s, r) => s + r.amount, 0);

  it('total-revenue lists only invoice/paid rows that the revenue card counts', async () => {
    const res = await service.getDrilldown({
      card: 'total-revenue',
      fiscalYear: 2023,
      filter: 'monthly',
    });
    expect(res.filterKeys).toEqual(['category', 'status']);
    expect(res.subtotalKey).toBe('category');
    expect(res.rows.map((r) => r.status).sort()).toEqual([
      'invoice',
      'paid',
      'paid',
    ]);
    expect(total(res.rows)).toBe(3000 + 2000 + 1200);
  });

  it('collection cards include AMCs without amc_start_date but never inactive orders', async () => {
    const res = await service.getDrilldown({
      card: 'amc-collection',
      fiscalYear: 2023,
    });
    expect(total(res.rows)).toBe(1200 + 700);
  });

  it('expected-vs-collected includes every scheduled status with the matching status date', async () => {
    const res = await service.getDrilldown({
      card: 'expected-vs-collected',
      fiscalYear: 2023,
    });
    const by = (ref: string) => res.rows.find((r) => r.reference === ref)!;

    expect(by('Advance')).toMatchObject({
      status: 'paid',
      clientName: 'Acme',
      productName: 'Laser Audit',
      invoiceNumber: 'INV-1',
    });
    expect(by('Advance').statusDate).toEqual(new Date('2023-06-01')); // paid -> received date
    expect(by('Delivery').statusDate).toEqual(
      new Date('2023-06-15T00:00:00.000Z'),
    ); // invoice -> invoice date
    expect(by('Go-live')).toMatchObject({
      status: 'to_be_created',
      statusDate: null,
    });
    expect(by('Report X')).toMatchObject({
      type: 'Customization',
      clientName: 'Acme',
      status: 'proforma',
    });
    expect(total(res.rows)).toBe(
      3000 + 2000 + 1000 + 800 + 500 + 1200 + 400 + 700,
    );
  });

  it('revenue-trend narrows to one period', async () => {
    const res = await service.getDrilldown({
      card: 'revenue-trend',
      fiscalYear: 2023,
      filter: 'monthly',
      period: 'May FY23-24',
    });
    expect(res.title).toContain('May FY23-24');
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({ reference: 'Advance', amount: 3000 });
  });

  it('applies filters and search (search matches status labels too)', async () => {
    const paid = await service.getDrilldown({
      card: 'expected-vs-collected',
      fiscalYear: 2023,
      filters: { status: ['paid'] },
    });
    expect(paid.rows.every((r) => r.status === 'paid')).toBe(true);

    const tbc = await service.getDrilldown({
      card: 'expected-vs-collected',
      fiscalYear: 2023,
      search: 'to be created',
    });
    expect(tbc.rows.map((r) => r.reference)).toEqual([
      'Go-live',
      'Undated TBC',
    ]);
  });

  it('pipeline summary: expected = invoiced + proforma + to be created, split New / AMC', async () => {
    const s = await service.getPipelineSummary({ fiscalYear: 2023 });
    expect(s.invoiced).toEqual({ newSales: 5000, amc: 1200, total: 6200 });
    expect(s.proforma).toEqual({ newSales: 500, amc: 400, total: 900 });
    expect(s.toBeCreated).toEqual({ newSales: 1800, amc: 0, total: 1800 });
    expect(s.expected).toEqual({ newSales: 7300, amc: 1600, total: 8900 });
    expect(s.expected.total).toBe(
      s.invoiced.total + s.proforma.total + s.toBeCreated.total,
    );
  });

  it('proforma / to-be-created / expected-revenue drill-downs match the pipeline cards', async () => {
    const [proforma, tbc, expected] = await Promise.all([
      service.getDrilldown({ card: 'proforma', fiscalYear: 2023 }),
      service.getDrilldown({ card: 'to-be-created', fiscalYear: 2023 }),
      service.getDrilldown({ card: 'expected-revenue', fiscalYear: 2023 }),
    ]);
    expect(proforma.rows.map((r) => [r.category, r.amount])).toEqual([
      ['New Order', 500],
      ['AMC', 400],
    ]);
    const amcProforma = proforma.rows.find((r) => r.category === 'AMC')!;
    expect(amcProforma.statusDate).toEqual(new Date('2023-09-25')); // proforma -> proforma date
    expect(total(tbc.rows)).toBe(1800);
    const undated = tbc.rows.find((r) => r.reference === 'Undated TBC')!;
    expect(undated).toMatchObject({
      dateBasis: 'PO date (not invoiced)',
      period: 'Nov FY23-24',
      invoiceDate: null,
    });
    expect(total(expected.rows)).toBe(8900);
    expect(expected.rows.some((r) => r.reference === 'Undated paid')).toBe(
      false,
    );

    const amcOnly = await service.getDrilldown({
      card: 'proforma',
      fiscalYear: 2023,
      filters: { category: ['AMC'] },
    });
    expect(amcOnly.rows).toHaveLength(1);
  });

  it('every line item links to its detail page', async () => {
    const res = await service.getDrilldown({
      card: 'expected-vs-collected',
      fiscalYear: 2023,
    });
    const by = (ref: string) => res.rows.find((r) => r.reference === ref)!;
    expect(by('Advance')._ref).toEqual({
      kind: 'order',
      id: String(orders[0]._id),
      clientId: String(clientA),
    });
    expect(by('Report X')._ref).toEqual({
      kind: 'customization',
      id: String(customizations[0]._id),
      clientId: String(clientA),
    });
    const amcRow = res.rows.find((r) => r.category === 'AMC')!;
    expect(amcRow._ref).toMatchObject({
      kind: 'amc',
      id: String((amcs[0].order_id as any)._id),
      clientId: String(clientB),
    });

    const health = await service.getDrilldown({
      card: 'client-health',
      fiscalYear: 2023,
    });
    expect(
      health.rows.every((r) => r._ref?.kind === 'client' && r._ref.id),
    ).toBe(true);
  });

  it('splits a license with payment terms into one row per term', async () => {
    const termLicense = {
      _id: new Types.ObjectId(),
      order_id: parentOrderId,
      product_id: productId,
      rate: { amount: 100 },
      total_license: 10,
      purchase_date: new Date('2023-09-01'),
      payment_terms: [
        {
          name: 'Advance',
          calculated_amount: 400,
          status: 'paid',
          invoice_number: 'L-1',
          invoice_date: new Date('2023-09-05'),
          payment_receive_date: new Date('2023-09-20'),
        },
        { name: 'Balance', calculated_amount: 600, status: 'to_be_created' },
      ],
    };
    const licenseModel = { find: jest.fn(() => chain([termLicense])) };
    const svc = new (DashboardDrilldownService as any)(
      ...[
        (service as any).orderModel,
        licenseModel,
        (service as any).customizationModel,
        (service as any).additionalServiceModel,
        (service as any).productModel,
        (service as any).clientModel,
        (service as any).amcModel,
      ],
      (service as any).revenueCalculatorService,
    );
    const res = await svc.getDrilldown({
      card: 'expected-vs-collected',
      fiscalYear: 2023,
    });
    const licRows = res.rows.filter((r: any) => r.type === 'License');
    expect(
      licRows.map((r: any) => [
        r.reference,
        r.amount,
        r.status,
        r.invoiceNumber,
      ]),
    ).toEqual([
      ['10 license(s) · Balance', 600, 'to_be_created', ''], // PO date 1 Sep sorts first
      ['10 license(s) · Advance', 400, 'paid', 'L-1'],
    ]);
    expect(licRows[0].dateBasis).toBe('PO date (not invoiced)');
  });

  it('exports dates as the India calendar day (not one day early)', async () => {
    const wb = await service.buildWorkbook({
      card: 'total-revenue',
      title: 'T',
      columns: [{ key: 'd', label: 'Date', type: 'date' }],
      rows: [{ d: '2026-05-13T18:30:00.000Z' }], // 14 May 2026 00:00 IST
    } as any);
    expect(wb.worksheets[0].getRow(4).getCell(1).value).toEqual(
      new Date(Date.UTC(2026, 4, 14)),
    );
  });

  it('rejects unknown cards', async () => {
    await expect(
      service.getDrilldown({ card: 'nope' as any, fiscalYear: 2023 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds an Excel dump with a header row and currency total', async () => {
    const res = await service.getDrilldown({
      card: 'total-revenue',
      fiscalYear: 2023,
    });
    const wb = await service.buildWorkbook(res);
    const ws = wb.worksheets[0];
    expect(ws.getRow(4).values).toEqual(
      expect.arrayContaining(['Status', 'Status Date', 'Invoice No']),
    );
    const last = ws.getRow(ws.rowCount);
    expect(last.getCell(1).value).toBe('Total (3 rows)');
    expect(last.getCell(8).value).toBe(6200);
    // New Order / AMC subtotal rows sit just above the total
    expect(ws.getRow(ws.rowCount - 2).getCell(1).value).toBe(
      'New Order (2 rows)',
    );
    expect(ws.getRow(ws.rowCount - 2).getCell(8).value).toBe(5000);
    expect(ws.getRow(ws.rowCount - 1).getCell(1).value).toBe('AMC (1 rows)');
    expect(ws.getRow(ws.rowCount - 1).getCell(8).value).toBe(1200);
  });
});
