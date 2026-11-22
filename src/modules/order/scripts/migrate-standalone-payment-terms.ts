/**
 * One-time migration: give every license / customization payment terms.
 *
 * Items saved before payment terms existed get ONE 100% term carrying their
 * current payment_status, invoice number/date/document and receive date.
 * Items that already have terms are left alone (idempotent).
 *
 * Usage (from server/):
 *   npm run migrate:standalone-terms -- --dry-run   # counts only
 *   npm run migrate:standalone-terms                # apply
 *
 * Raw collection updates (no Mongoose middleware). Reports already handle
 * un-migrated items (virtual 100% term), so this can run any time after deploy.
 */
import mongoose from 'mongoose';
import {
  customizationBaseAmount,
  legacyPaymentTerm,
  licenseBaseAmount,
} from '../utils/standalone-payment-terms';

const TARGETS = [
  { collection: 'licenses', base: licenseBaseAmount },
  { collection: 'customizations', base: customizationBaseAmount },
];

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
  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Adding payment terms to licenses/customizations on db "${db.databaseName}"`,
  );

  for (const { collection, base } of TARGETS) {
    const col = db.collection(collection);
    const filter = {
      $or: [
        { payment_terms: { $exists: false } },
        { payment_terms: { $size: 0 } },
      ],
    };
    const docs = await col.find(filter).toArray();
    console.log(`  [${collection}] ${docs.length} documents without payment terms`);
    if (dryRun || docs.length === 0) continue;

    const ops = docs.map((doc) => {
      const term = legacyPaymentTerm(doc, base(doc));
      return {
        updateOne: {
          filter: { _id: doc._id, ...filter },
          update: {
            $set: {
              payment_terms: [
                {
                  ...term,
                  invoice_date: term.invoice_date ? new Date(term.invoice_date as any) : null,
                  payment_receive_date: term.payment_receive_date
                    ? new Date(term.payment_receive_date as any)
                    : null,
                },
              ],
              payment_status: term.status,
            },
          },
        },
      };
    });
    const res = await col.bulkWrite(ops);
    console.log(`    updated ${res.modifiedCount} documents`);
  }

  await conn.close();
  console.log(dryRun ? 'Dry run complete, nothing written.' : 'Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
