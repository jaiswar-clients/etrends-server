import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from '@/db/schema/order/product-order.schema';
import { AMC } from '@/db/schema/amc/amc.schema';
import { License } from '@/db/schema/order/license.schema';
import { Customization } from '@/db/schema/order/customization.schema';
import { AdditionalService } from '@/db/schema/order/additional-service.schema';
import { Client } from '@/db/schema/client.schema';
import { Product } from '@/db/schema/product.schema';
import { LoggerService } from '@/common/logger/services/logger.service';
import {
  ORDER_STATUS_ENUM,
  PAYMENT_STATUS_ENUM,
} from '@/common/types/enums/order.enum';

export type PendingType =
  | 'order'
  | 'amc'
  | 'license'
  | 'customization'
  | 'additional_service'
  | 'all';

export interface PendingPaymentRow {
  _id: string;
  payment_identifier: string;
  type: 'order' | 'amc' | 'license' | 'customization';
  client_name: string;
  product_name: string;
  invoice_number?: string;
  invoice_date?: Date;
  payment_date?: Date;
  pending_amount: number;
  order_total: number;
  balance: number;
  status: PAYMENT_STATUS_ENUM;
}

@Injectable()
export class PendingPaymentService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(AMC.name) private amcModel: Model<AMC>,
    @InjectModel(License.name) private licenseModel: Model<License>,
    @InjectModel(Customization.name)
    private customizationModel: Model<Customization>,
    @InjectModel(AdditionalService.name)
    private additionalServiceModel: Model<AdditionalService>,
    @InjectModel(Client.name) private clientModel: Model<Client>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    private loggerService: LoggerService,
  ) {}

  async getPendingPayments(args: {
    page: number;
    limit: number;
    startDate?: string;
    endDate?: string;
    clientId?: string;
    clientName?: string;
    type?: PendingType;
  }) {
    const { page, limit } = args;
    const dateRange = this.parseDateRange(args.startDate, args.endDate);
    const clientFilter = await this.resolveClientFilter(
      args.clientId,
      args.clientName,
    );
    const activeOrderIds = await this.getActiveOrderIds(clientFilter);

    const sources: PendingPaymentRow[][] = [];
    if (this.shouldFetch('order', args.type))
      sources.push(
        await this.fetchOrderPending(activeOrderIds, clientFilter, dateRange),
      );
    if (this.shouldFetch('amc', args.type))
      sources.push(
        await this.fetchAmcPending(activeOrderIds, clientFilter, dateRange),
      );
    if (this.shouldFetch('license', args.type))
      sources.push(
        await this.fetchLicensePending(activeOrderIds, dateRange),
      );
    if (this.shouldFetch('customization', args.type))
      sources.push(
        await this.fetchCustomizationPending(activeOrderIds, dateRange),
      );

    const merged = sources
      .flat()
      .sort(
        (a, b) =>
          (b.invoice_date?.getTime() ?? 0) -
          (a.invoice_date?.getTime() ?? 0),
      );
    const start = (page - 1) * limit;
    const paged = merged.slice(start, start + limit);

    return {
      pending_payments: paged,
      pagination: {
        total: merged.length,
        currentPage: page,
        totalPages: Math.ceil(merged.length / limit),
        limit,
        hasNextPage: start + limit < merged.length,
        hasPreviousPage: page > 1,
      },
    };
  }

  async exportPendingPaymentsToExcel(args: {
    startDate?: string;
    endDate?: string;
    clientId?: string;
    clientName?: string;
    type?: PendingType;
  }): Promise<Buffer> {
    const dateRange = this.parseDateRange(args.startDate, args.endDate);
    const clientFilter = await this.resolveClientFilter(
      args.clientId,
      args.clientName,
    );
    const activeOrderIds = await this.getActiveOrderIds(clientFilter);

    const sources: PendingPaymentRow[][] = [];
    if (this.shouldFetch('order', args.type))
      sources.push(
        await this.fetchOrderPending(activeOrderIds, clientFilter, dateRange),
      );
    if (this.shouldFetch('amc', args.type))
      sources.push(
        await this.fetchAmcPending(activeOrderIds, clientFilter, dateRange),
      );
    if (this.shouldFetch('license', args.type))
      sources.push(
        await this.fetchLicensePending(activeOrderIds, dateRange),
      );
    if (this.shouldFetch('customization', args.type))
      sources.push(
        await this.fetchCustomizationPending(activeOrderIds, dateRange),
      );

    const merged = sources
      .flat()
      .sort(
        (a, b) =>
          (b.invoice_date?.getTime() ?? 0) -
          (a.invoice_date?.getTime() ?? 0),
      );

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AMC Management System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Pending Payments');

    worksheet.columns = [
      { header: 'Client Name', key: 'client_name', width: 25 },
      { header: 'Product Name', key: 'product_name', width: 25 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Invoice Number', key: 'invoice_number', width: 20 },
      { header: 'Invoice Date', key: 'invoice_date', width: 15 },
      { header: 'Pending Amount', key: 'pending_amount', width: 15 },
      { header: 'Order Total', key: 'order_total', width: 15 },
      { header: 'Balance', key: 'balance', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    for (const row of merged) {
      worksheet.addRow({
        client_name: row.client_name,
        product_name: row.product_name,
        type: row.type,
        invoice_number: row.invoice_number ?? '-',
        invoice_date: row.invoice_date
          ? new Date(row.invoice_date).toLocaleDateString('en-GB')
          : '-',
        pending_amount: row.pending_amount,
        order_total: row.order_total,
        balance: row.balance,
        status: row.status,
      });
    }

    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }

  private shouldFetch(t: PendingType, requested?: PendingType) {
    return !requested || requested === 'all' || requested === t;
  }

  private parseDateRange(
    start?: string,
    end?: string,
  ): { $gte?: Date; $lte?: Date } | null {
    if (!start && !end) return null;
    const range: any = {};
    if (start) {
      const d = new Date(start);
      if (!isNaN(d.getTime())) range.$gte = d;
    }
    if (end) {
      const d = new Date(end);
      if (!isNaN(d.getTime())) range.$lte = d;
    }
    return Object.keys(range).length ? range : null;
  }

  private async resolveClientFilter(
    clientId?: string,
    clientName?: string,
  ) {
    if (clientId && Types.ObjectId.isValid(clientId)) {
      return { client_id: new Types.ObjectId(clientId) };
    }
    if (clientName?.trim()) {
      const clients = await this.clientModel
        .find({ name: { $regex: clientName, $options: 'i' } })
        .select('_id')
        .lean();
      if (!clients.length) return { client_id: { $in: [] } };
      return { client_id: { $in: clients.map((c) => c._id) } };
    }
    return {};
  }

  private async getActiveOrderIds(clientFilter: any) {
    return this.orderModel
      .find({ status: ORDER_STATUS_ENUM.ACTIVE, ...clientFilter })
      .distinct('_id') as Promise<Types.ObjectId[]>;
  }

  private async fetchOrderPending(
    orderIds: Types.ObjectId[],
    clientFilter: any,
    dateRange: { $gte?: Date; $lte?: Date } | null,
  ): Promise<PendingPaymentRow[]> {
    if (!orderIds.length) return [];

    const pipeline: any[] = [
      { $match: { _id: { $in: orderIds }, ...clientFilter } },
      {
        $unwind: { path: '$payment_terms', includeArrayIndex: 'termIndex' },
      },
      {
        $match: {
          'payment_terms.status': PAYMENT_STATUS_ENUM.PENDING,
          'payment_terms.invoice_date': { $exists: true, $ne: null },
          'payment_terms.invoice_number': {
            $exists: true,
            $nin: [null, ''],
          },
          'payment_terms.calculated_amount': { $gt: 0 },
        },
      },
    ];

    if (dateRange) {
      const stringRange: any = {};
      if (dateRange.$gte) stringRange.$gte = dateRange.$gte.toISOString();
      if (dateRange.$lte) {
        const endOfDay = new Date(dateRange.$lte);
        endOfDay.setUTCHours(23, 59, 59, 999);
        stringRange.$lte = endOfDay.toISOString();
      }
      pipeline.push({
        $match: { 'payment_terms.invoice_date': stringRange },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'clients',
          localField: 'client_id',
          foreignField: '_id',
          as: 'client',
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'products',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
    );

    const docs = await this.orderModel.aggregate(pipeline);
    return docs.map((d) => ({
      _id: d._id.toString(),
      payment_identifier: `${d._id.toString()}::${d.termIndex}`,
      type: 'order' as const,
      client_name: d.client?.[0]?.name ?? 'N/A',
      product_name: (d.productDetails || [])
        .map((p: any) => p.short_name)
        .join(', '),
      invoice_number: d.payment_terms.invoice_number,
      invoice_date: d.payment_terms.invoice_date
        ? new Date(d.payment_terms.invoice_date)
        : undefined,
      payment_date: d.payment_terms.invoice_date
        ? new Date(d.payment_terms.invoice_date)
        : undefined,
      pending_amount: d.payment_terms.calculated_amount,
      order_total: d.base_cost,
      balance: d.base_cost
        ? d.payment_terms.calculated_amount / d.base_cost
        : 0,
      status: d.payment_terms.status,
    }));
  }

  private async fetchAmcPending(
    orderIds: Types.ObjectId[],
    clientFilter: any,
    dateRange: { $gte?: Date; $lte?: Date } | null,
  ): Promise<PendingPaymentRow[]> {
    if (!orderIds.length) return [];

    const pipeline: any[] = [
      { $match: { order_id: { $in: orderIds }, ...clientFilter } },
      {
        $unwind: { path: '$payments', includeArrayIndex: 'paymentIndex' },
      },
      {
        $match: {
          'payments.status': PAYMENT_STATUS_ENUM.PENDING,
          'payments.invoice_date': { $exists: true, $ne: null },
        },
      },
    ];

    if (dateRange) {
      pipeline.push({
        $match: { 'payments.invoice_date': dateRange },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'clients',
          localField: 'client_id',
          foreignField: '_id',
          as: 'client',
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'products',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
    );

    const docs = await this.amcModel.aggregate(pipeline);
    return docs.map((d) => ({
      _id: d._id.toString(),
      payment_identifier: `${d._id.toString()}::${d.paymentIndex}`,
      type: 'amc' as const,
      client_name: d.client?.[0]?.name ?? 'N/A',
      product_name: (d.productDetails || [])
        .map((p: any) => p.short_name)
        .join(', '),
      invoice_number: d.payments.invoice_number,
      invoice_date: d.payments.invoice_date,
      payment_date: d.payments.from_date,
      pending_amount: d.payments.amc_rate_amount ?? 0,
      order_total: d.amount,
      balance: d.amount ? (d.payments.amc_rate_amount ?? 0) / d.amount : 0,
      status: d.payments.status,
    }));
  }

  private async fetchLicensePending(
    orderIds: Types.ObjectId[],
    dateRange: { $gte?: Date; $lte?: Date } | null,
  ): Promise<PendingPaymentRow[]> {
    if (!orderIds.length) return [];

    const orderIdStrings = orderIds.map((id) => id.toString());
    const filter: any = {
      order_id: { $in: orderIdStrings },
      payment_status: PAYMENT_STATUS_ENUM.PENDING,
      invoice_date: { $exists: true, $ne: null },
    };
    if (dateRange) filter.invoice_date = dateRange;

    const docs = await this.licenseModel.find(filter).lean();
    if (!docs.length) return [];

    const productIds = docs
      .map((d: any) => d.product_id)
      .filter(Boolean);

    const [orders, products] = await Promise.all([
      this.orderModel
        .find({ _id: { $in: orderIdStrings } })
        .populate('client_id', 'name')
        .lean(),
      this.productModel
        .find({ _id: { $in: productIds } })
        .select('short_name')
        .lean(),
    ]);

    const orderMap = new Map(
      orders.map((o: any) => [o._id.toString(), o]),
    );
    const productMap = new Map(
      products.map((p: any) => [p._id.toString(), p]),
    );

    return docs.map((l: any) => {
      const order = orderMap.get(
        l.order_id?.toString?.() || l.order_id,
      );
      const product = productMap.get(
        l.product_id?.toString?.() || l.product_id,
      );
      return {
        _id: l._id.toString(),
        payment_identifier: l._id.toString(),
        type: 'license' as const,
        client_name: (order?.client_id as any)?.name ?? 'N/A',
        product_name: product?.short_name ?? 'N/A',
        invoice_number: l.invoice_number,
        invoice_date: l.invoice_date,
        payment_date: l.invoice_date,
        pending_amount: l.cost,
        order_total: l.cost,
        balance: 1,
        status: l.payment_status,
      };
    });
  }

  private async fetchCustomizationPending(
    orderIds: Types.ObjectId[],
    dateRange: { $gte?: Date; $lte?: Date } | null,
  ): Promise<PendingPaymentRow[]> {
    if (!orderIds.length) return [];

    const orderIdStrings = orderIds.map((id) => id.toString());
    const filter: any = {
      order_id: { $in: orderIdStrings },
      payment_status: PAYMENT_STATUS_ENUM.PENDING,
      invoice_date: { $exists: true, $ne: null },
    };
    if (dateRange) filter.invoice_date = dateRange;

    const docs = await this.customizationModel.find(filter).lean();
    if (!docs.length) return [];

    const productIds = docs
      .map((d: any) => d.product_id)
      .filter(Boolean);

    const [orders, products] = await Promise.all([
      this.orderModel
        .find({ _id: { $in: orderIdStrings } })
        .populate('client_id', 'name')
        .lean(),
      this.productModel
        .find({ _id: { $in: productIds } })
        .select('short_name')
        .lean(),
    ]);

    const orderMap = new Map(
      orders.map((o: any) => [o._id.toString(), o]),
    );
    const productMap = new Map(
      products.map((p: any) => [p._id.toString(), p]),
    );

    return docs.map((c: any) => {
      const order = orderMap.get(
        c.order_id?.toString?.() || c.order_id,
      );
      const product = productMap.get(
        c.product_id?.toString?.() || c.product_id,
      );
      return {
        _id: c._id.toString(),
        payment_identifier: c._id.toString(),
        type: 'customization' as const,
        client_name: (order?.client_id as any)?.name ?? 'N/A',
        product_name: product?.short_name ?? 'N/A',
        invoice_number: c.invoice_number,
        invoice_date: c.invoice_date,
        payment_date: c.invoice_date,
        pending_amount: c.cost,
        order_total: c.cost,
        balance: 1,
        status: c.payment_status,
      };
    });
  }

  async getAmcStartMissing(args: {
    page: number;
    limit: number;
    clientId?: string;
    clientName?: string;
  }) {
    const clientFilter = await this.resolveClientFilter(
      args.clientId,
      args.clientName,
    );
    const match: any = {
      status: ORDER_STATUS_ENUM.ACTIVE,
      $or: [{ amc_start_date: { $exists: false } }, { amc_start_date: null }],
      ...clientFilter,
    };
    const skip = (args.page - 1) * args.limit;
    const [rows, total] = await Promise.all([
      this.orderModel
        .find(match)
        .skip(skip)
        .limit(args.limit)
        .populate('client_id', 'name')
        .populate('products', 'short_name')
        .lean(),
      this.orderModel.countDocuments(match),
    ]);
    return {
      rows: rows.map((o: any) => ({
        order_id: o._id.toString(),
        client_name: o.client_id?.name ?? 'N/A',
        product_name: (o.products || [])
          .map((p: any) => p.short_name)
          .join(', '),
        purchased_date: o.purchased_date,
        base_cost: o.base_cost,
        pending_balance: o.pending_balance,
      })),
      pagination: {
        total,
        currentPage: args.page,
        totalPages: Math.ceil(total / args.limit),
        limit: args.limit,
      },
    };
  }

  async updatePendingPaymentStatus(
    id: string,
    type: PendingType,
    paymentIdentifier: string | number,
    body: { status: PAYMENT_STATUS_ENUM; payment_receive_date: Date | string },
  ) {
    this.loggerService.log(
      JSON.stringify({
        message: 'updatePendingPaymentStatus: Starting payment update',
        id,
        type,
        paymentIdentifier,
        body,
      }),
    );

    const paymentReceiveDate = new Date(body.payment_receive_date);
    const index = String(paymentIdentifier).includes('::')
      ? String(paymentIdentifier).split('::')[1]
      : String(paymentIdentifier);

    let updatedPayment;
    switch (type) {
      case 'amc':
        updatedPayment = await this.amcModel.findByIdAndUpdate(id, {
          [`payments.${index}.status`]: body.status,
          [`payments.${index}.payment_receive_date`]: paymentReceiveDate,
        });
        break;
      case 'order':
        updatedPayment = await this.orderModel.findByIdAndUpdate(id, {
          [`payment_terms.${index}.status`]: body.status,
          [`payment_terms.${index}.payment_receive_date`]: paymentReceiveDate,
        });
        if (updatedPayment && body.status === PAYMENT_STATUS_ENUM.PAID) {
          const oldStatus =
            updatedPayment.payment_terms?.[parseInt(index, 10)]?.status;
          if (oldStatus !== PAYMENT_STATUS_ENUM.PAID) {
            const amount =
              updatedPayment.payment_terms?.[parseInt(index, 10)]
                ?.calculated_amount ?? 0;
            await this.orderModel.updateOne(
              { _id: id },
              { $inc: { pending_balance: -amount, total_paid: amount } },
            );
          }
        }
        break;
      case 'license':
        updatedPayment = await this.licenseModel.findByIdAndUpdate(id, {
          payment_status: body.status,
          payment_receive_date: paymentReceiveDate,
        });
        break;
      case 'customization':
        updatedPayment = await this.customizationModel.findByIdAndUpdate(id, {
          payment_status: body.status,
          payment_receive_date: paymentReceiveDate,
        });
        break;
      case 'additional_service':
        updatedPayment = await this.additionalServiceModel.findByIdAndUpdate(
          id,
          {
            payment_status: body.status,
            payment_receive_date: paymentReceiveDate,
          },
        );
        break;
      default:
        throw new HttpException('Invalid payment type', HttpStatus.BAD_REQUEST);
    }

    if (!updatedPayment) {
      throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
    }

    this.loggerService.log(
      JSON.stringify({
        message: 'updatePendingPaymentStatus: Payment updated successfully',
        id,
        type,
        paymentIdentifier,
      }),
    );

    return updatedPayment;
  }
}
