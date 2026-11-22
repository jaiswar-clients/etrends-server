# Project Context for Claude

## Revenue Calculation Rules

### New Sales Revenue

New sales revenue includes FOUR sources. All must be summed:

1. **Orders** (`productorders` collection): Query by `'payment_terms.invoice_date'` in range. Inside loop, check `termInvoiceDate` is within range. Iterate `payment_terms` where `status` is `paid` or `invoice`. Revenue = `term.calculated_amount`.
2. **Standalone Customizations** (`customizations` collection): Query by `invoice_date` in range, `payment_status` in (`paid`, `invoice`), `deleted != true`. Revenue = `cost`. Group by `invoice_date`.
3. **Standalone Licenses** (`licenses` collection): Query by `invoice_date` in range, `payment_status` in (`paid`, `invoice`), `deleted != true`. Revenue = `license.rate.amount * total_license`. Group by `invoice_date`.
4. **Additional Services** (`additionalservices` collection): Query by `invoice_date` in range, `payment_status` in (`paid`, `invoice`), `deleted != true`. Revenue = `cost`. Group by `invoice_date`. Client resolved via `order_id` (no `client_id` on document).

**Strict rule**: Use `invoice_date` ONLY for all new sales queries. Do NOT use `purchased_date`, `purchase_date`, or `purchased_date` anywhere for revenue date filtering or grouping.

**Important**: Customizations and licenses are stored in separate collections. The `order.customizations` and `order.licenses` arrays in the Order schema are rarely populated in practice. Always query the standalone collections.

**License order_id**: `license.order_id` is stored as a STRING in MongoDB, not ObjectId. Mongoose `findById()` casts it automatically.

**CRITICAL: `payment_terms.invoice_date` is stored as BSON string, not Date**. MongoDB cannot compare strings with Date objects using `$gte`/`$lte`. For order queries, use ISO string bounds:
```typescript
'payment_terms.invoice_date': { $gte: start.toISOString(), $lte: end.toISOString() }
```
Inside loops, parse with `new Date(term.invoice_date)` before comparing.

`customizations.invoice_date` and `licenses.invoice_date` ARE proper BSON dates — Date-object queries work for them.

### AMC Revenue

AMC revenue calculation MUST exclude AMCs linked to orders with `status === 'inactive'`. The inactive order check is:

```typescript
const order = amc.order_id as any;
if (order?.status === 'inactive') continue;
```

This applies to ALL AMC iteration sites:
- `calculateAMCRevenue`
- `getExpectedVsCollected`
- `getMonthlyBreakdown`
- `getClientHealthMetrics` (all 3 loops: activity, overdue, renewal rate)
- `getTopPerformers`
- `getClientConcentrationRisk`
- `getClientWiseRevenueBreakdown`

### Data Model Notes

- **Order statuses**: `active`, `inactive`. 19 inactive orders exist as of 2026-05-15.
- **Client deleted**: Only 1 soft-deleted client (`"Etrends Test"`). "Inactive client" in AMC context means linked order is inactive, NOT client `deleted`.
- **Collections**: `orders` (not `productorders` — Mongoose pluralizes to `orders`).
- **FY**: April 1 to March 31.

## Gotchas

- `customizationModel` does NOT have a `client_id` field. Client must be resolved via `customization.order_id -> order.client_id`.
- `licenseModel` also lacks `client_id`. Same resolution path.
- `additionalServiceModel` also lacks `client_id`. Same resolution path.
- `getClientHealthMetrics` previously did NOT populate `order_id` on AMCs. Must add `.populate({ path: 'order_id', model: 'Order' })` to check order status.

## Schema Pitfalls

### Array-of-ObjectId refs: use `MongooseSchema.Types.ObjectId`, NOT `Types.ObjectId`

NestJS `@Prop` for array-of-ref fields MUST use `mongoose.Schema.Types.ObjectId` (the SchemaType), NOT `mongoose.Types.ObjectId` (the BSON type). `@nestjs/mongoose`'s `DefinitionsFactory.inspectTypeDefinition` only recognizes types whose prototype extends `mongoose.SchemaType` (via `isMongooseSchemaType()`). `Types.ObjectId` (BSON) does NOT — it compiles to a `Mixed` caster with no `ref`, so `.populate()` silently no-ops and returns raw string ids. `MongooseSchema.Types.ObjectId` (SchemaType) compiles correctly to an `ObjectId` caster with `ref` preserved.

```typescript
// WRONG — caster.instance = Mixed, ref = undefined, populate no-ops
@Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }] })
products: Types.ObjectId[];

// CORRECT — caster.instance = ObjectId, ref = 'Product', populate works
@Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Product' }] })
products: Types.ObjectId[];
```

This was the root cause of `product_names: [null]` in pending-payments: `.populate('products')` returned raw string ids, then `p.short_name` on a string returned `undefined`, serializing to `[null]`.

Affected props in `product-order.schema.ts` (all fixed 2026-07-08): `products`, `licenses`, `customizations`, `additional_services`. Single-ref props (`client_id`, `amc_id`) used `Types.ObjectId` and worked because `@nestjs/mongoose` treats them differently (no nested array unwrap).

Note: DB stores these refs as STRINGS, not ObjectIds (all 157 product refs are strings). Mongoose casts strings to ObjectId for populate automatically once the caster is correct — no data migration needed.

## Pending Payments

### Calculation source

Pending payments for new orders come SOLELY from `order.payment_terms` entries (one row per term, `amount = pt.calculated_amount`). This is the only correct source.

UI name is **Outstanding Payments** (route `/outstanding-payments`; `/pending-payments` redirects). The API (`GET /orders/pending-payments`, `/orders/export-pending-payments`) takes `status` (comma-separated); default = outstanding = `invoice` only (client requirement 2026-11-22). Other statuses can be requested explicitly. Row `invoice_date` is the real invoice date (null when not invoiced); `row_date` (invoice date, else PO / AMC from date) is only the FY-filter/sort basis.

### `pending_balance` / `total_paid` are STALE — do not trust

`order.pending_balance` and `order.total_paid` are set ONLY at order creation (`order.service.ts:402-403`) and NEVER updated afterwards, despite the schema comment claiming "Updated on payment_term status changes and on AMC assignment." The update code does not exist anywhere in `src/` — only the `backfill-pending-balance.ts` script computes them, and it was never run for most orders.

Example (Suzlon order `6a4778dc00ebc8a39bcb5556`): `total_paid=0`, `pending_balance=650000` while `payment_terms[0]` (375000) is `status: 'paid'`. Real values should be `total_paid=375000`, `pending_balance=275000`.

Do NOT use `pending_balance` for any pending calculation. Derive from `payment_terms` directly:
```typescript
const paid    = payment_terms.filter(t => t.status === 'paid').reduce((s,t) => s + t.calculated_amount, 0);
const pending = payment_terms.filter(t => ['to_be_created','invoice'].includes(t.status)).reduce((s,t) => s + t.calculated_amount, 0);
const remaining = base_cost - paid; // = pending + any unscheduled gap
```

### Removed: "PO balance gap" row (Scenario 3)

Previously `getPendingPayments` (order.service.ts) synthesized an extra `_gap` row when `pending_balance > pendingInvoiceSum`. This was removed 2026-07-08 because: (a) it depended on the stale `pending_balance` field, producing phantom rows (275000 ghost row for Suzlon); (b) 0/128 active orders legitimately triggered it; (c) `payment_terms` already represents all scheduled payments — anything outside a term is unscheduled, not "pending payment."

## Dashboard drill-downs

Every Revenue Dashboard card opens a table from `GET /reports/drilldown?card=...` (`DashboardDrilldownService`); `GET /reports/drilldown/export` streams the same table as xlsx (honours `filterValues` / `search`). Revenue cards reuse `RevenueCalculatorService` eligibility (invoice + paid; AMC also needs `order.amc_start_date`) so table totals equal the card values. Status Date = received date (paid) / invoice date (invoice) / proforma date (proforma, AMC only) / empty (to_be_created).

## Payment terms on licenses / customizations

Licenses and customizations have `payment_terms` (same shape as `orders.payment_terms`; base = `rate.amount × total_license` / `cost`). Item-level `payment_status`, `invoice_*`, `payment_receive_date` are a summary written on save (`summarizePaymentTerms`). Reports must iterate terms via `effectivePaymentTerms()` / `RevenueCalculatorService.standaloneTermRows()` (`src/modules/order/utils/standalone-payment-terms.ts`); items without terms (pre-migration) are treated as one 100% term. Migration: `npm run migrate:standalone-terms` (idempotent).

## Payment status lifecycle

`PAYMENT_STATUS_ENUM`: `to_be_created` -> `proforma` -> `invoice` -> `paid`. Shared by `orders.payment_terms[].status`, `amcs.payments[].status`, and `payment_status` on licenses / customizations / additional services. Default for new rows is `to_be_created` (UI label "To be Created", see `PAYMENT_STATUS_LABELS`).

`to_be_created` replaced the legacy `pending` value on 2026-11-21. Existing data is converted by `npm run migrate:payment-status` (see `MIGRATIONS.md`). Controllers still map a legacy `pending` in the `filter` / `payment_status` query params to `to_be_created` via `normalizePaymentStatus`. "Pending Payments" (the page/endpoint) is unchanged as a concept: it lists `to_be_created` + `invoice` rows.
