import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { Workbook } from 'exceljs';
import { Order, OrderDocument } from '@/db/schema/order/product-order.schema';
import { License, LicenseDocument } from '@/db/schema/order/license.schema';
import {
  Customization,
  CustomizationDocument,
} from '@/db/schema/order/customization.schema';
import {
  AdditionalService,
  AdditionalServiceDocument,
} from '@/db/schema/order/additional-service.schema';
import { Product, ProductDocument } from '@/db/schema/product.schema';
import { Client, ClientDocument } from '@/db/schema/client.schema';
import { AMC, AMCDocument } from '@/db/schema/amc/amc.schema';
import {
  PAYMENT_STATUS_ENUM,
  PAYMENT_STATUS_LABELS,
  normalizePaymentStatus,
} from '@/common/types/enums/order.enum';
import { RevenueCalculatorService } from './revenue-calculator.service';
import {
  customizationBaseAmount,
  effectivePaymentTerms,
  licenseBaseAmount,
  standaloneTermsDateFilter,
  termAmount,
} from '@/modules/order/utils/standalone-payment-terms';
import {
  DRILLDOWN_CARDS,
  DrilldownCard,
  IDrilldownColumn,
  IDrilldownQuery,
  IDrilldownResponse,
  IRevenuePipelineSummary,
  IRowRef,
  IStreamTotals,
} from '../dto/drilldown.dto';

type Stream = 'new' | 'amc';

/** One payment row (order term, standalone item, or AMC payment). */
interface ILineItem {
  stream: Stream;
  /** Detail page this row links to. */
  ref?: IRowRef;
  /** Which date placed the row in its period (see BASIS_LABEL). */
  dateBasis: string;
  type: string;
  clientName: string;
  productName: string;
  reference: string;
  amount: number;
  status: string;
  statusDate: Date | null;
  invoiceNumber: string;
  invoiceDate: Date | null;
  receivedDate: Date | null;
  date: Date;
  period: string;
  /** AMC rows: getRevenueDashboard additionally requires order.amc_start_date */
  inRevenueDashboard: boolean;
}

const INVOICED = new Set<string>([
  PAYMENT_STATUS_ENUM.INVOICE,
  PAYMENT_STATUS_ENUM.PAID,
]);
const SCHEDULED = new Set<string>(Object.values(PAYMENT_STATUS_ENUM));

const LINE_ITEM_COLUMNS: IDrilldownColumn[] = [
  { key: 'period', label: 'Period', type: 'text' },
  { key: 'dateBasis', label: 'Period Basis', type: 'text' },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'clientName', label: 'Client', type: 'text' },
  { key: 'type', label: 'Type', type: 'text' },
  { key: 'productName', label: 'Product', type: 'text' },
  { key: 'reference', label: 'Term / AMC Period', type: 'text' },
  { key: 'amount', label: 'Amount', type: 'currency' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'statusDate', label: 'Status Date', type: 'date' },
  { key: 'invoiceNumber', label: 'Invoice No', type: 'text' },
  { key: 'invoiceDate', label: 'Invoice Date', type: 'date' },
  { key: 'receivedDate', label: 'Received Date', type: 'date' },
];

const TITLES: Record<DrilldownCard, string> = {
  'total-revenue': 'Total Revenue',
  'new-sales': 'New Sales Revenue',
  'amc-revenue': 'AMC Revenue',
  'revenue-split': 'Revenue Split (New Sales vs AMC)',
  'revenue-trend': 'Revenue',
  'collection-rate': 'Collection (Invoiced vs Collected)',
  'sales-collection': 'Sales Collection',
  'amc-collection': 'AMC Collection',
  'expected-vs-collected': 'Expected vs Collected',
  'client-health': 'Client Health',
  'client-performance': 'Client Performance',
  'concentration-risk': 'Concentration Risk (Client Revenue Share)',
  'expected-revenue': 'Expected Revenue',
  proforma: 'Proforma Invoice',
  'to-be-created': 'To be Created',
};

/** Shown in the "Period Basis" column. */
const BASIS_LABEL = {
  invoice: 'Invoice date',
  purchase: 'PO date (not invoiced)',
  amc: 'AMC period start',
} as const;

/** Subtotal order in Excel dumps. */
const GROUP_ORDER = ['New Order', 'AMC'];

const idOf = (v: unknown): string | undefined =>
  v ? String((v as any)?._id ?? v) : undefined;

const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? null : d;
};

const fmtShort = (d: Date | null) =>
  d
    ? d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

/**
 * Drill-down tables (and Excel dumps) behind every Revenue Dashboard card.
 * Revenue cards reuse the same eligibility rules as RevenueCalculatorService so
 * the table totals match the card values.
 */
@Injectable()
export class DashboardDrilldownService {
  constructor(
    @InjectModel(Order.name) private orderModel: SoftDeleteModel<OrderDocument>,
    @InjectModel(License.name)
    private licenseModel: SoftDeleteModel<LicenseDocument>,
    @InjectModel(Customization.name)
    private customizationModel: SoftDeleteModel<CustomizationDocument>,
    @InjectModel(AdditionalService.name)
    private additionalServiceModel: SoftDeleteModel<AdditionalServiceDocument>,
    @InjectModel(Product.name)
    private productModel: SoftDeleteModel<ProductDocument>,
    @InjectModel(Client.name)
    private clientModel: SoftDeleteModel<ClientDocument>,
    @InjectModel(AMC.name) private amcModel: SoftDeleteModel<AMCDocument>,
    private readonly revenueCalculatorService: RevenueCalculatorService,
  ) {}

  async getDrilldown(query: IDrilldownQuery): Promise<IDrilldownResponse> {
    const { card } = query;
    if (!DRILLDOWN_CARDS.includes(card)) {
      throw new BadRequestException(`Unknown drill-down card "${card}"`);
    }

    const response = await this.buildTable(query);

    // Filter chips: OR within a column, AND across columns
    for (const key of response.filterKeys ?? []) {
      const values = query.filters?.[key];
      if (!values?.length) continue;
      const allowed = new Set(values);
      response.rows = response.rows.filter((r) => allowed.has(String(r[key])));
    }
    const term = query.search?.trim().toLowerCase();
    if (term) {
      const cols = response.columns.filter(
        (c) => c.type === 'text' || c.type === 'status',
      );
      response.rows = response.rows.filter((r) =>
        cols.some((c) => {
          const v = String(r[c.key] ?? '');
          const label =
            c.type === 'status'
              ? (PAYMENT_STATUS_LABELS[v as PAYMENT_STATUS_ENUM] ?? '')
              : '';
          return (
            v.toLowerCase().includes(term) || label.toLowerCase().includes(term)
          );
        }),
      );
    }
    return response;
  }

  /**
   * Values for the Expected Revenue / Proforma / To be Created cards.
   * Built from the same line items as their drill-downs, so card = table total.
   */
  async getPipelineSummary(query: {
    fiscalYear: number;
    orderTypes?: string;
  }): Promise<IRevenuePipelineSummary> {
    const { fiscalYear } = query;
    const items = (
      await this.buildLineItems({ card: 'expected-revenue', ...query })
    ).filter((i) => i.inRevenueDashboard);
    const empty = (): IStreamTotals => ({ newSales: 0, amc: 0, total: 0 });
    const out = {
      invoiced: empty(),
      proforma: empty(),
      toBeCreated: empty(),
      expected: empty(),
    };
    const add = (t: IStreamTotals, i: ILineItem) => {
      if (i.stream === 'amc') t.amc += i.amount;
      else t.newSales += i.amount;
      t.total += i.amount;
    };
    for (const i of items) {
      add(out.expected, i);
      if (INVOICED.has(i.status)) add(out.invoiced, i);
      else if (i.status === PAYMENT_STATUS_ENUM.PROFORMA) add(out.proforma, i);
      else if (i.status === PAYMENT_STATUS_ENUM.TO_BE_CREATED)
        add(out.toBeCreated, i);
    }
    return {
      fiscalYear: `FY${(fiscalYear % 100).toString().padStart(2, '0')}-${((fiscalYear + 1) % 100).toString().padStart(2, '0')}`,
      ...out,
    };
  }

  private async buildTable(
    query: IDrilldownQuery,
  ): Promise<IDrilldownResponse> {
    const { card, fiscalYear, period } = query;
    const fyLabel = `FY${(fiscalYear % 100).toString().padStart(2, '0')}-${((fiscalYear + 1) % 100).toString().padStart(2, '0')}`;
    const title = period ? `${TITLES[card]} · ${period}` : TITLES[card];

    switch (card) {
      case 'total-revenue':
      case 'revenue-split':
      case 'revenue-trend':
      case 'new-sales':
      case 'amc-revenue': {
        const stream: Stream | undefined =
          card === 'new-sales'
            ? 'new'
            : card === 'amc-revenue'
              ? 'amc'
              : undefined;
        const items = (await this.buildLineItems(query)).filter(
          (i) =>
            i.inRevenueDashboard &&
            INVOICED.has(i.status) &&
            (!stream || i.stream === stream) &&
            (!period || i.period === period),
        );
        return this.lineItemTable(
          card,
          title,
          fyLabel,
          items,
          'Revenue = Invoice + Paid rows',
        );
      }
      case 'collection-rate':
      case 'sales-collection':
      case 'amc-collection': {
        const stream: Stream | undefined =
          card === 'sales-collection'
            ? 'new'
            : card === 'amc-collection'
              ? 'amc'
              : undefined;
        const items = (await this.buildLineItems(query)).filter(
          (i) =>
            INVOICED.has(i.status) &&
            (!stream || i.stream === stream) &&
            (!period || i.period === period),
        );
        return this.lineItemTable(
          card,
          title,
          fyLabel,
          items,
          'Invoiced rows; Paid = collected',
        );
      }
      case 'expected-vs-collected': {
        const items = (await this.buildLineItems(query)).filter(
          (i) => !period || i.period === period,
        );
        return this.lineItemTable(
          card,
          title,
          fyLabel,
          items,
          'All scheduled rows: To be Created / Proforma / Invoice / Paid',
        );
      }
      case 'expected-revenue':
      case 'proforma':
      case 'to-be-created': {
        const only =
          card === 'proforma'
            ? PAYMENT_STATUS_ENUM.PROFORMA
            : card === 'to-be-created'
              ? PAYMENT_STATUS_ENUM.TO_BE_CREATED
              : undefined;
        const items = (await this.buildLineItems(query)).filter(
          (i) =>
            i.inRevenueDashboard &&
            (!only || i.status === only) &&
            (!period || i.period === period),
        );
        return this.lineItemTable(
          card,
          title,
          fyLabel,
          items,
          card === 'expected-revenue'
            ? 'Total Revenue (Invoice + Paid) + Proforma + To be Created'
            : 'New Orders + AMC',
        );
      }
      case 'client-health':
        return this.clientHealthTable(fiscalYear, title, fyLabel);
      case 'client-performance':
        return this.clientPerformanceTable(fiscalYear, title, fyLabel);
      case 'concentration-risk':
        return this.concentrationTable(fiscalYear, title, fyLabel);
    }
  }

  private lineItemTable(
    card: DrilldownCard,
    title: string,
    fyLabel: string,
    items: ILineItem[],
    subtitle: string,
  ): IDrilldownResponse {
    items.sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() ||
        a.clientName.localeCompare(b.clientName),
    );
    return {
      card,
      title,
      subtitle: `${fyLabel} · ${subtitle}`,
      columns: LINE_ITEM_COLUMNS,
      filterKeys: ['category', 'status'],
      subtotalKey: 'category',
      rows: items.map((i) => ({
        _ref: i.ref,
        period: i.period,
        dateBasis: i.dateBasis,
        category: i.stream === 'amc' ? 'AMC' : 'New Order',
        clientName: i.clientName,
        type: i.type,
        productName: i.productName,
        reference: i.reference,
        amount: i.amount,
        status: i.status,
        statusDate: i.statusDate,
        invoiceNumber: i.invoiceNumber,
        invoiceDate: i.invoiceDate,
        receivedDate: i.receivedDate,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Line items
  // ---------------------------------------------------------------------------

  private async buildLineItems(query: IDrilldownQuery): Promise<ILineItem[]> {
    const calc = this.revenueCalculatorService;
    const { start, end } = calc.getFiscalYearRange(query.fiscalYear);
    const filter = query.filter || 'monthly';
    const includeNew = calc.shouldIncludeStream('new', query.orderTypes);
    const includeAMC = calc.shouldIncludeStream('amc', query.orderTypes);

    const [clients, products] = await Promise.all([
      this.clientModel.find({}).select('name industry').lean(),
      this.productModel.find({}).select('name short_name').lean(),
    ]);
    const clientName = new Map(
      clients.map((c: any) => [String(c._id), c.name as string]),
    );
    const productName = new Map(
      products.map((p: any) => [
        String(p._id),
        (p.name || p.short_name) as string,
      ]),
    );
    const nameOfClient = (id: unknown) =>
      clientName.get(String((id as any)?._id ?? id)) || 'Unknown';
    const namesOfProducts = (ids: unknown[] = []) =>
      ids
        .map((id) => productName.get(String((id as any)?._id ?? id)))
        .filter(Boolean)
        .join(', ');

    const items: ILineItem[] = [];
    const push = (
      base: Omit<ILineItem, 'status' | 'statusDate' | 'period'> & {
        rawStatus?: string;
        proformaDate?: Date | null;
      },
    ) => {
      if (!base.rawStatus) return;
      const status = normalizePaymentStatus(base.rawStatus);
      if (!SCHEDULED.has(status)) return;
      const { proformaDate, ...rest } = base;
      delete rest.rawStatus;
      items.push({
        ...rest,
        status,
        statusDate:
          status === PAYMENT_STATUS_ENUM.PAID
            ? base.receivedDate
            : status === PAYMENT_STATUS_ENUM.INVOICE
              ? base.invoiceDate
              : status === PAYMENT_STATUS_ENUM.PROFORMA
                ? (proformaDate ?? null)
                : null,
        period: calc.getPeriodLabel(base.date, filter),
      });
    };

    if (includeNew) {
      const orders = await this.orderModel
        .find(calc.newSalesOrderFilter(start, end))
        .lean();
      for (const order of orders as any[]) {
        if (!calc.isNewSaleOrder(order)) continue;
        for (const term of order.payment_terms || []) {
          const placed = calc.newSalesRowDate(
            term.status,
            term.invoice_date,
            order.purchased_date,
          );
          if (!placed || placed.date < start || placed.date > end) continue;
          const invoiceDate = toDate(term.invoice_date);
          push({
            dateBasis: BASIS_LABEL[placed.basis],
            stream: 'new',
            type: 'Order',
            ref: {
              kind: 'order',
              id: String(order._id),
              clientId: idOf(order.client_id),
            },
            clientName: nameOfClient(order.client_id),
            productName: namesOfProducts(order.products) || 'N/A',
            reference: term.name || '',
            amount: term.calculated_amount || 0,
            rawStatus: term.status,
            invoiceNumber: term.invoice_number || '',
            invoiceDate,
            receivedDate: toDate(term.payment_receive_date),
            date: placed.date,
            inRevenueDashboard: true,
          });
        }
      }

      const [customizations, licenses, services] = await Promise.all([
        this.customizationModel
          .find(standaloneTermsDateFilter(start, end, 'purchased_date'))
          .lean(),
        this.licenseModel
          .find(standaloneTermsDateFilter(start, end, 'purchase_date'))
          .lean(),
        this.additionalServiceModel
          .find(calc.standaloneNewSalesFilter(start, end, 'purchased_date'))
          .lean(),
      ]);

      // Standalone items have no client_id: resolve via order_id -> order.client_id
      const orderIds = [...customizations, ...licenses, ...services]
        .map((x: any) => x.order_id)
        .filter(Boolean);
      const parentOrders = await this.orderModel
        .find({ _id: { $in: orderIds } })
        .select('client_id')
        .lean();
      const clientOfOrder = new Map(
        parentOrders.map((o: any) => [String(o._id), o.client_id]),
      );
      const clientOf = (orderId: unknown) =>
        nameOfClient(clientOfOrder.get(String(orderId)));

      // Customizations + licenses: one row per payment term (items without
      // terms count as one 100% term from their legacy fields)
      const termItems = [
        ...(customizations as any[]).map((c) => ({
          kind: 'customization' as const,
          item: c,
          base: customizationBaseAmount(c),
          purchaseDate: c.purchased_date,
        })),
        ...(licenses as any[]).map((l) => ({
          kind: 'license' as const,
          item: l,
          base: licenseBaseAmount(l),
          purchaseDate: l.purchase_date,
        })),
      ];
      for (const { kind, item, base, purchaseDate } of termItems) {
        if (kind === 'license' && base === 0) continue;
        const hasTerms =
          Array.isArray(item.payment_terms) && item.payment_terms.length > 0;
        for (const term of effectivePaymentTerms(item, base)) {
          const placed = calc.newSalesRowDate(
            term.status,
            term.invoice_date,
            purchaseDate,
          );
          if (!placed || placed.date < start || placed.date > end) continue;
          const label =
            kind === 'customization'
              ? item.title || 'Customization'
              : `${item.total_license || 0} license(s)`;
          push({
            dateBasis: BASIS_LABEL[placed.basis],
            stream: 'new',
            type: kind === 'customization' ? 'Customization' : 'License',
            ref: {
              kind,
              id: String(item._id),
              clientId: idOf(clientOfOrder.get(String(item.order_id))),
            },
            clientName: clientOf(item.order_id),
            productName: namesOfProducts([item.product_id]) || 'N/A',
            reference: hasTerms ? `${label} · ${term.name || 'Term'}` : label,
            amount: termAmount(term, base),
            rawStatus: term.status || PAYMENT_STATUS_ENUM.TO_BE_CREATED,
            invoiceNumber: term.invoice_number || '',
            invoiceDate: toDate(term.invoice_date),
            receivedDate: toDate(term.payment_receive_date),
            date: placed.date,
            inRevenueDashboard: true,
          });
        }
      }
      for (const s of services as any[]) {
        const placed = calc.newSalesRowDate(
          s.payment_status,
          s.invoice_date,
          s.purchased_date,
        );
        if (!placed || placed.date < start || placed.date > end || !s.cost)
          continue;
        const invoiceDate = toDate(s.invoice_date);
        push({
          dateBasis: BASIS_LABEL[placed.basis],
          stream: 'new',
          type: 'Additional Service',
          ref: {
            kind: 'additional_service',
            id: String(s._id),
            clientId: idOf(clientOfOrder.get(String(s.order_id))),
          },
          clientName: clientOf(s.order_id),
          productName: namesOfProducts([s.product_id]) || 'N/A',
          reference: s.name || 'Additional Service',
          amount: s.cost,
          rawStatus: s.payment_status,
          invoiceNumber: s.invoice_number || '',
          invoiceDate,
          receivedDate: toDate(s.payment_receive_date),
          date: placed.date,
          inRevenueDashboard: true,
        });
      }
    }

    if (includeAMC) {
      const amcs = await (this.amcModel as any)
        .findWithDeleted()
        .populate({ path: 'order_id', model: 'Order' })
        .lean();
      for (const amc of amcs as any[]) {
        const order = amc.order_id as any;
        if (order?.status === 'inactive') continue;
        for (const p of amc.payments || []) {
          const from = toDate(p.from_date);
          if (!from || from < start || from > end) continue;
          push({
            dateBasis: BASIS_LABEL.amc,
            stream: 'amc',
            type: 'AMC',
            // AMC detail page is keyed by the linked order id
            ref: order?._id
              ? {
                  kind: 'amc',
                  id: String(order._id),
                  clientId: idOf(amc.client_id ?? order.client_id),
                }
              : undefined,
            clientName: nameOfClient(amc.client_id ?? order?.client_id),
            productName:
              namesOfProducts(
                amc.products?.length ? amc.products : order?.products,
              ) || 'N/A',
            reference: `${fmtShort(from)} – ${fmtShort(toDate(p.to_date))}`,
            amount: p.amc_rate_amount || 0,
            rawStatus: p.status,
            proformaDate: toDate(p.proforma_date),
            invoiceNumber: p.invoice_number || '',
            invoiceDate: toDate(p.invoice_date),
            receivedDate: toDate(p.received_date),
            date: from,
            inRevenueDashboard: !!order?.amc_start_date,
          });
        }
      }
    }

    return items;
  }

  // ---------------------------------------------------------------------------
  // Client tables
  // ---------------------------------------------------------------------------

  /** Per-client rows behind the Client Health card: active = activity in the FY (same rules as getClientHealthMetrics). */
  private async clientHealthTable(
    fiscalYear: number,
    title: string,
    fyLabel: string,
  ): Promise<IDrilldownResponse> {
    const { start, end } =
      this.revenueCalculatorService.getFiscalYearRange(fiscalYear);

    const [clients, orders, amcs] = await Promise.all([
      this.clientModel
        .find({ deleted: { $ne: true } })
        .select('name industry')
        .lean(),
      this.orderModel
        .find({
          'payment_terms.invoice_date': {
            $gte: start.toISOString(),
            $lte: end.toISOString(),
          },
          deleted: { $ne: true },
        })
        .select('client_id')
        .lean(),
      (this.amcModel as any)
        .findWithDeleted()
        .populate({ path: 'order_id', model: 'Order' })
        .lean(),
    ]);

    // Active = an order with a payment term invoiced in the FY, or a non-proforma AMC payment in the FY
    const active = new Set<string>(
      (orders as any[]).map((o) => String(o.client_id)),
    );
    for (const amc of amcs as any[]) {
      if (amc.order_id?.status === 'inactive') continue;
      const inFY = (amc.payments || []).some((p: any) => {
        if (p.status === PAYMENT_STATUS_ENUM.PROFORMA) return false;
        const from = toDate(p.from_date);
        return !!from && from >= start && from <= end;
      });
      if (inFY) active.add(String(amc.client_id));
    }

    const rows = (clients as any[])
      .map((c) => ({
        _ref: { kind: 'client', id: String(c._id) } as IRowRef,
        clientName: c.name,
        industry: c.industry || '',
        activity: active.has(String(c._id)) ? 'Active' : 'Inactive',
      }))
      .sort(
        (x, y) =>
          x.activity.localeCompare(y.activity) ||
          x.clientName.localeCompare(y.clientName),
      );

    return {
      card: 'client-health',
      title,
      subtitle: `${fyLabel} · Active = order term invoiced or AMC payment in the FY`,
      filterKeys: ['activity'],
      columns: [
        { key: 'clientName', label: 'Client', type: 'text' },
        { key: 'industry', label: 'Industry', type: 'text' },
        { key: 'activity', label: 'Status (FY)', type: 'text' },
      ],
      rows,
    };
  }

  private async clientPerformanceTable(
    fiscalYear: number,
    title: string,
    fyLabel: string,
  ): Promise<IDrilldownResponse> {
    const { topClients, atRiskClients } =
      await this.revenueCalculatorService.getTopPerformers(
        fiscalYear,
        Number.MAX_SAFE_INTEGER,
      );
    const atRisk = new Map(atRiskClients.map((c) => [c.clientId, c]));
    const all = [
      ...topClients,
      ...atRiskClients.filter(
        (c) => !topClients.some((t) => t.clientId === c.clientId),
      ),
    ];
    return {
      card: 'client-performance',
      title,
      subtitle: `${fyLabel} · All clients by revenue, at-risk flagged`,
      filterKeys: ['segment'],
      columns: [
        { key: 'clientName', label: 'Client', type: 'text' },
        { key: 'industry', label: 'Industry', type: 'text' },
        { key: 'segment', label: 'Segment', type: 'text' },
        { key: 'totalRevenue', label: 'Total Revenue', type: 'currency' },
        { key: 'newSalesRevenue', label: 'New Sales', type: 'currency' },
        { key: 'amcRevenue', label: 'AMC', type: 'currency' },
        { key: 'orderCount', label: 'Orders', type: 'number' },
        { key: 'trend', label: 'Trend', type: 'text' },
        { key: 'trendPercentage', label: 'Trend %', type: 'percent' },
        { key: 'riskFactors', label: 'Risk Factors', type: 'text' },
      ],
      rows: all
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .map((c) => ({
          _ref: { kind: 'client', id: c.clientId } as IRowRef,
          clientName: c.clientName,
          industry: c.industry || '',
          segment: atRisk.has(c.clientId) ? 'At Risk' : 'Healthy',
          totalRevenue: c.totalRevenue,
          newSalesRevenue: c.newSalesRevenue,
          amcRevenue: c.amcRevenue,
          orderCount: c.orderCount,
          trend: c.trend,
          trendPercentage: c.trendPercentage,
          riskFactors: (
            atRisk.get(c.clientId)?.riskFactors ??
            c.riskFactors ??
            []
          ).join('; '),
        })),
    };
  }

  private async concentrationTable(
    fiscalYear: number,
    title: string,
    fyLabel: string,
  ): Promise<IDrilldownResponse> {
    const data =
      await this.revenueCalculatorService.getClientWiseRevenueBreakdown(
        fiscalYear,
      );
    let cumulative = 0;
    return {
      card: 'concentration-risk',
      title,
      subtitle: `${fyLabel} · Clients ranked by revenue share`,
      filterKeys: ['industry'],
      columns: [
        { key: 'rank', label: '#', type: 'number' },
        { key: 'clientName', label: 'Client', type: 'text' },
        { key: 'industry', label: 'Industry', type: 'text' },
        { key: 'newSalesRevenue', label: 'New Sales', type: 'currency' },
        { key: 'amcRevenue', label: 'AMC', type: 'currency' },
        { key: 'totalRevenue', label: 'Total Revenue', type: 'currency' },
        { key: 'percentageOfTotal', label: '% of Total', type: 'percent' },
        { key: 'cumulativePercentage', label: 'Cumulative %', type: 'percent' },
      ],
      rows: data.clients.map((c, idx) => {
        cumulative += c.percentageOfTotal;
        return {
          _ref: { kind: 'client', id: c.clientId } as IRowRef,
          rank: idx + 1,
          clientName: c.clientName,
          industry: c.industry || 'Unknown',
          newSalesRevenue: c.newSalesRevenue,
          amcRevenue: c.amcRevenue,
          totalRevenue: c.totalRevenue,
          percentageOfTotal: c.percentageOfTotal,
          cumulativePercentage: cumulative,
        };
      }),
    };
  }

  // ---------------------------------------------------------------------------
  // Excel dump
  // ---------------------------------------------------------------------------

  async buildWorkbook(table: IDrilldownResponse): Promise<Workbook> {
    const workbook = new Workbook();
    workbook.creator = 'Etrends AMC';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(
      table.title.replace(/[\\/?*[\]:]/g, '-').slice(0, 31),
    );

    sheet.addRow([table.title]).font = { bold: true, size: 14 };
    if (table.subtitle)
      sheet.addRow([table.subtitle]).font = {
        italic: true,
        color: { argb: 'FF64748B' },
      };
    sheet.addRow([]);

    const header = sheet.addRow(table.columns.map((c) => c.label));
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' },
      };
    });
    sheet.views = [{ state: 'frozen', ySplit: header.number }];

    for (const r of table.rows) {
      const row = sheet.addRow(
        table.columns.map((c) => {
          const v = r[c.key];
          if (v === null || v === undefined || v === '') return null;
          switch (c.type) {
            case 'date':
              return toDate(v);
            case 'status':
              return PAYMENT_STATUS_LABELS[v as PAYMENT_STATUS_ENUM] ?? v;
            case 'percent':
              return Number(v) / 100;
            default:
              return v;
          }
        }),
      );
      table.columns.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        if (c.type === 'currency') cell.numFmt = '"₹"#,##0.00';
        if (c.type === 'date') cell.numFmt = 'dd-mmm-yyyy';
        if (c.type === 'percent') cell.numFmt = '0.0%';
      });
    }

    // Totals for currency columns
    const currencyIdx = table.columns
      .map((c, i) => (c.type === 'currency' ? i : -1))
      .filter((i) => i >= 0);
    // Subtotals per group (e.g. New Order / AMC)
    if (currencyIdx.length && table.rows.length && table.subtotalKey) {
      const key = table.subtotalKey;
      const rank = (g: string) => {
        const i = GROUP_ORDER.indexOf(g);
        return i < 0 ? GROUP_ORDER.length : i;
      };
      const groups = [
        ...new Set(table.rows.map((r) => String(r[key] ?? ''))),
      ].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
      for (const group of groups) {
        const groupRows = table.rows.filter(
          (r) => String(r[key] ?? '') === group,
        );
        const sub: (string | number | null)[] = table.columns.map(() => null);
        sub[0] = `${group} (${groupRows.length} rows)`;
        for (const i of currencyIdx) {
          sub[i] = groupRows.reduce(
            (s, r) => s + (Number(r[table.columns[i].key]) || 0),
            0,
          );
        }
        const subRow = sheet.addRow(sub);
        subRow.font = { italic: true };
        for (const i of currencyIdx)
          subRow.getCell(i + 1).numFmt = '"₹"#,##0.00';
      }
    }
    if (currencyIdx.length && table.rows.length) {
      const totals: (string | number | null)[] = table.columns.map(() => null);
      totals[0] = `Total (${table.rows.length} rows)`;
      for (const i of currencyIdx) {
        totals[i] = table.rows.reduce(
          (s, r) => s + (Number(r[table.columns[i].key]) || 0),
          0,
        );
      }
      const totalRow = sheet.addRow(totals);
      totalRow.font = { bold: true };
      for (const i of currencyIdx)
        totalRow.getCell(i + 1).numFmt = '"₹"#,##0.00';
    }

    table.columns.forEach((c, i) => {
      sheet.getColumn(i + 1).width =
        c.type === 'currency'
          ? 16
          : c.type === 'date'
            ? 14
            : c.type === 'text'
              ? 24
              : 12;
    });
    return workbook;
  }
}
