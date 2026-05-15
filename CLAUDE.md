# Project Context for Claude

## Revenue Calculation Rules

### New Sales Revenue

New sales revenue includes FOUR sources. All must be summed:

1. **Orders** (`productorders` collection): Query by `'payment_terms.invoice_date'` in range. Inside loop, check `termInvoiceDate` is within range. Iterate `payment_terms` where `status` is `paid` or `invoice`. Revenue = `term.calculated_amount`.
2. **Standalone Customizations** (`customizations` collection): Query by `invoice_date` in range, `payment_status` in (`paid`, `invoice`), `deleted != true`. Revenue = `cost`. Group by `invoice_date`.
3. **Standalone Licenses** (`licenses` collection): Query by `invoice_date` in range, `payment_status` in (`paid`, `invoice`), `deleted != true`. Revenue = `total_license * order.cost_per_license` (look up linked order). Group by `invoice_date`.
4. **Additional Services** (`additionalservices` collection): Query by `invoice_date` in range, `payment_status` in (`paid`, `invoice`), `deleted != true`. Revenue = `cost`. Group by `invoice_date`. Client resolved via `order_id` (no `client_id` on document).

**Strict rule**: Use `invoice_date` ONLY for all new sales queries. Do NOT use `purchased_date`, `purchase_date`, or `purchased_date` anywhere for revenue date filtering or grouping.

**Important**: Customizations and licenses are stored in separate collections. The `order.customizations` and `order.licenses` arrays in the Order schema are rarely populated in practice. Always query the standalone collections.

**License cost fallback**: When `order.cost_per_license` is 0 or undefined, compute from `order.base_cost / order.licenses_with_base_price` (when `licenses_with_base_price > 0`). This applies to ALL license revenue lookups.

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
