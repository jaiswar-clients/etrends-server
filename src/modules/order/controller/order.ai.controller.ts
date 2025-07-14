import { Controller, Get, Query } from '@nestjs/common';
import { OrderAiService } from '../services/order.ai.service';

@Controller('order-ai')
export class OrderAiController {
  constructor(private readonly orderAiService: OrderAiService) {}

  @Get('customer-product-adoption-report')
  async getCustomerProductAdoptionReport(
    @Query('enableThinking') enableThinking?: string,
  ) {
    const useThinking = enableThinking === 'true';
    const markdown =
      await this.orderAiService.getCustomerProductAdoptionReport(useThinking);
    return { markdown };
  }

  @Get('industry-product-distribution-report')
  async getIndustryProductDistributionReport(
    @Query('enableThinking') enableThinking?: string,
  ) {
    const useThinking = enableThinking === 'true';
    const markdown =
      await this.orderAiService.getIndustryProductDistributionReport(
        useThinking,
      );
    return { markdown };
  }

  @Get('domestic-international-revenue-report')
  async getDomesticInternationalRevenueReport(
    @Query('enableThinking') enableThinking?: string,
  ) {
    const useThinking = enableThinking === 'true';
    const markdown =
      await this.orderAiService.getDomesticInternationalRevenueReport(
        useThinking,
      );
    return { markdown };
  }

  @Get('direct-franchise-sales-report')
  async getDirectFranchiseSalesReport(
    @Query('enableThinking') enableThinking?: string,
  ) {
    const useThinking = enableThinking === 'true';
    const markdown =
      await this.orderAiService.getDirectFranchiseSalesReport(useThinking);
    return { markdown };
  }

  @Get('product-realisation-variation-report')
  async getProductRealisationVariationReport(
    @Query('enableThinking') enableThinking?: string,
  ) {
    const markdown =
      await this.orderAiService.getProductRealisationVariationReport(
        enableThinking === 'true',
      );
    return { markdown };
  }

  @Get('upsell-potential-clients-report')
  async getUpsellPotentialClientsReport(
    @Query('enableThinking') enableThinking?: string,
  ) {
    const markdown =
      await this.orderAiService.getUpsellPotentialClientsReport(
        enableThinking === 'true',
      );
    return { markdown };
  }

  @Get('cross-sell-opportunities-report')
  async getCrossSellOpportunitiesReport(
    @Query('enableThinking') enableThinking?: string,
  ) {
    const markdown =
      await this.orderAiService.getCrossSellOpportunitiesReport(
        enableThinking === 'true',
      );
    return { markdown };
  }

  @Get('partner-performance-report')
  async getPartnerPerformanceReport(
    @Query('enableThinking') enableThinking?: string,
  ) {
    const markdown =
      await this.orderAiService.getPartnerPerformanceReport(
        enableThinking === 'true',
      );
    return { markdown };
  }
}
