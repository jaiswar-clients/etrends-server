import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '@/db/schema/order/product-order.schema';
import { License, LicenseSchema } from '@/db/schema/order/license.schema';
import { Product, ProductSchema } from '@/db/schema/product.schema';
import { Client, ClientSchema } from '@/db/schema/client.schema';
import { AMC, AMCSchema } from '@/db/schema/amc/amc.schema';
import {
  Customization,
  CustomizationSchema,
} from '@/db/schema/order/customization.schema';
import {
  AdditionalService,
  AdditionalServiceSchema,
} from '@/db/schema/order/additional-service.schema';
import { FilterPreset, FilterPresetSchema } from '@/db/schema/filter-preset.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: License.name, schema: LicenseSchema },
      { name: Customization.name, schema: CustomizationSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Client.name, schema: ClientSchema },
      { name: AdditionalService.name, schema: AdditionalServiceSchema },
      { name: AMC.name, schema: AMCSchema },
      { name: FilterPreset.name, schema: FilterPresetSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
