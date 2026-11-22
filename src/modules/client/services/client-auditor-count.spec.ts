import { Types } from 'mongoose';
import { ClientService } from './client.service';

// Raw collection mock: collection.find(query).project().toArray()
const rawCollection = (rows: any[], match: (q: any, r: any) => boolean) => ({
  collection: {
    find: jest.fn((q: any) => ({
      project: () => ({
        toArray: () => Promise.resolve(rows.filter((r) => match(q, r))),
      }),
    })),
  },
});

describe('ClientService.getAuditorCounts', () => {
  const clientA = new Types.ObjectId();
  const clientB = new Types.ObjectId();
  const product = new Types.ObjectId();
  const activeOrder = {
    _id: new Types.ObjectId(),
    client_id: String(clientA),
    status: 'active',
    licenses_with_base_price: 10,
    products: [String(product)],
    purchased_date: new Date('2024-10-23'),
  };
  const inactiveOrder = {
    _id: new Types.ObjectId(),
    client_id: String(clientA),
    status: 'inactive',
    licenses_with_base_price: 50,
  };
  const orderB = {
    _id: new Types.ObjectId(),
    client_id: clientB,
    status: 'active',
    licenses_with_base_price: 0,
  };
  const orders = [activeOrder, inactiveOrder, orderB];
  const licenses = [
    {
      _id: new Types.ObjectId(),
      order_id: String(activeOrder._id),
      total_license: 20,
      product_id: product,
      purchase_date: new Date('2025-03-17'),
      payment_status: 'paid',
    },
    {
      _id: new Types.ObjectId(),
      order_id: String(activeOrder._id),
      total_license: 5,
      payment_status: 'to_be_created',
    },
    {
      _id: new Types.ObjectId(),
      order_id: String(inactiveOrder._id),
      total_license: 99,
      payment_status: 'paid',
    },
    {
      _id: new Types.ObjectId(),
      order_id: String(orderB._id),
      total_license: 3,
      payment_status: 'paid',
    },
  ];

  const inList = (list: any[], v: any) =>
    list.some((x) => String(x) === String(v));
  const orderModel = rawCollection(
    orders,
    (q, o) => inList(q.client_id.$in, o.client_id) && o.status !== q.status.$ne,
  );
  const licenseModel = rawCollection(licenses, (q, l) =>
    inList(q.order_id.$in, l.order_id),
  );
  const productModel = {
    find: () => ({
      select: () => ({
        lean: () => Promise.resolve([{ _id: product, short_name: 'LARS' }]),
      }),
    }),
  };
  const service = new (ClientService as any)(
    {},
    orderModel,
    productModel,
    {},
    {},
    licenseModel,
    { log: jest.fn() },
  );

  it('sums base auditors from active orders and additional licenses, skipping inactive orders', async () => {
    const counts = await service.getAuditorCounts([
      String(clientA),
      String(clientB),
    ]);
    expect(counts.get(String(clientA))).toEqual({
      base: 10,
      additional: 25,
      total: 35,
    });
    expect(counts.get(String(clientB))).toEqual({
      base: 0,
      additional: 3,
      total: 3,
    });
  });

  it('returns a dated breakdown when asked', async () => {
    const counts = await service.getAuditorCounts([String(clientA)], true);
    const details = counts.get(String(clientA)).details;
    expect(details.map((d: any) => [d.source, d.count])).toEqual([
      ['Additional License', 5], // undated sorts first
      ['New Order', 10],
      ['Additional License', 20],
    ]);
    expect(details.find((d: any) => d.count === 20)).toMatchObject({
      products: 'LARS',
      paymentStatus: 'paid',
    });
  });

  it('returns zeros for clients without orders', async () => {
    const other = String(new Types.ObjectId());
    const counts = await service.getAuditorCounts([other]);
    expect(counts.get(other)).toEqual({ base: 0, additional: 0, total: 0 });
  });
});
