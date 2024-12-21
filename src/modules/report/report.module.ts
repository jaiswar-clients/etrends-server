import { Module, OnModuleInit } from '@nestjs/common';
import { ReportController } from './controllers/report.controller';
import { ReportService } from './services/report.service';
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
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule implements OnModuleInit {
  constructor(private readonly reportService: ReportService) {}
  async onModuleInit() {
    // const data=await this.reportService.getIndustryWiseRevenueDistribution("all")
    // console.log(data);
    
  }
}
