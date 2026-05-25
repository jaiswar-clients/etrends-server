import { NestFactory } from '@nestjs/core';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../../app.module';
import { Order } from '../../../db/schema/order/product-order.schema';

async function backfill() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const orderModel = app.get<Model<Order>>(getModelToken(Order.name));
  const orders = await orderModel.find({}).lean();

  let updated = 0;
  for (const o of orders as any[]) {
    const paid = ((o as any).payment_terms || [])
      .filter((t: any) => t.status === 'paid')
      .reduce((s: number, t: any) => s + (t.calculated_amount || 0), 0);
    const pending = ((o as any).base_cost || 0) - paid;
    await orderModel.updateOne(
      { _id: (o as any)._id },
      { $set: { pending_balance: pending, total_paid: paid } },
    );
    updated += 1;
  }
  console.log(`Backfilled ${updated} orders.`);
  await app.close();
}
backfill().catch((e) => {
  console.error(e);
  process.exit(1);
});
