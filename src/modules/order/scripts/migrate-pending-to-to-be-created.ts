/**
 * One-time migration: payment status 'pending' -> 'to_be_created'.
 *
 * Touches:
 *   - orders.payment_terms[].status
 *   - amcs.payments[].status
 *   - licenses / customizations / additionalservices .payment_status
 *
 * Usage (from server/):
 *   npm run migrate:payment-status -- --dry-run   # counts only, no writes
 *   npm run migrate:payment-status                # apply
 *
 * Idempotent: re-running after success finds 0 rows to update.
 * Raw collection updates (no Mongoose validation) because 'pending' is no
 * longer a valid enum value.
 */
import mongoose from 'mongoose';

const FROM = 'pending';
const TO = 'to_be_created';

const ARRAY_TARGETS = [
  { collection: 'orders', array: 'payment_terms' },
  { collection: 'amcs', array: 'payments' },
];
const FIELD_TARGETS = ['licenses', 'customizations', 'additionalservices'];

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const loadEnvFile = (process as any).loadEnvFile;
  if (typeof loadEnvFile === 'function') {
    try {
      loadEnvFile('.env');
    } catch {
      // fall through to the DATABASE_URL check below
    }
  }
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const conn = await mongoose.createConnection(url).asPromise();
  const db = conn.db;
  const existing = new Set(
    (await db.listCollections().toArray()).map((c) => c.name),
  );

  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Migrating payment status '${FROM}' -> '${TO}' on db "${db.databaseName}"`,
  );

  for (const { collection, array } of ARRAY_TARGETS) {
    if (!existing.has(collection)) {
      console.warn(`  [${collection}] collection not found, skipped`);
      continue;
    }
    const col = db.collection(collection);
    const path = `${array}.status`;
    const filter = { [path]: FROM };
    const docs = await col.countDocuments(filter);
    const [agg] = await col
      .aggregate([
        { $match: filter },
        { $unwind: `$${array}` },
        { $match: { [path]: FROM } },
        { $count: 'n' },
      ])
      .toArray();
    console.log(
      `  [${collection}.${array}] ${agg?.n ?? 0} entries in ${docs} documents`,
    );
    if (!dryRun && docs > 0) {
      const res = await col.updateMany(
        filter,
        { $set: { [`${array}.$[el].status`]: TO } },
        { arrayFilters: [{ 'el.status': FROM }] },
      );
      console.log(`    updated ${res.modifiedCount} documents`);
    }
  }

  for (const collection of FIELD_TARGETS) {
    if (!existing.has(collection)) {
      console.warn(`  [${collection}] collection not found, skipped`);
      continue;
    }
    const col = db.collection(collection);
    const filter = { payment_status: FROM };
    const docs = await col.countDocuments(filter);
    console.log(`  [${collection}.payment_status] ${docs} documents`);
    if (!dryRun && docs > 0) {
      const res = await col.updateMany(filter, {
        $set: { payment_status: TO },
      });
      console.log(`    updated ${res.modifiedCount} documents`);
    }
  }

  await conn.close();
  console.log(dryRun ? 'Dry run complete, nothing written.' : 'Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
