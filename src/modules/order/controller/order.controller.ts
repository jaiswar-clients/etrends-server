import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrderService } from '../services/order.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { CreateLicenseDto } from '../dto/create-license.dto';
import { CreateAdditionalServiceDto } from '../dto/create-additional-service.dto';
import { CreateCustomizationDto } from '../dto/create-customization.service.dto';
import { UpdateAMCDto } from '../dto/update-amc.dto';
import { AMC_FILTER } from '@/common/types/enums/order.enum';
import { AuthGuard } from '@/common/guards/auth.guard';
import { UpdatePendingPaymentDto } from '../dto/update-pending-payment';

export type UpdateOrderType = CreateOrderDto;

@Controller('orders')
@UseGuards(AuthGuard)
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Get('/all-orders')
  async loadAllOrdersWithAttributes(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    const parsedPage = parseInt(page.toString());
    const parsedLimit = parseInt(limit.toString());
    return this.orderService.loadAllOrdersWithAttributes(
      parsedPage,
      parsedLimit,
    );
  }

  @Get('/all-amc')
  async loadAllAMC(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('filter') filter: AMC_FILTER,
    @Query('upcoming') upcoming: string,
  ) {
    const parsedPage = parseInt(page.toString());
    const parsedLimit = parseInt(limit.toString());
    const parsedUpcoming = parseInt(upcoming) || 1;

    return this.orderService.loadAllAMC(
      parsedPage,
      parsedLimit,
      filter || AMC_FILTER.UPCOMING,
      { upcoming: parsedUpcoming },
    );
  }

  @Get('/pending-payments')
  async getAllPendingPayments(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    const parsedPage = parseInt(page.toString());
    const parsedLimit = parseInt(limit.toString());
    return this.orderService.getAllPendingPayments(parsedPage, parsedLimit);
  }

  @Get('/:id')
  async getOrderById(@Param('id') orderId: string) {
    return this.orderService.getOrderById(orderId);
  }

  @Get('/:id/amc')
  async getAMCByOrderId(@Param('id') orderId: string) {
    return this.orderService.getAmcByOrderId(orderId);
  }

  @Get('/client/:id')
  async getOrdersByClientId(@Param('id') clientId: string) {
    return this.orderService.getOrdersByClientId(clientId);
  }

  @Get('/license/:id')
  async getLicenseById(@Param('id') orderId: string) {
    return this.orderService.getLicenseById(orderId);
  }

  @Get('/additional-service/:id')
  async getAdditionalServiceById(@Param('id') orderId: string) {
    return this.orderService.getAdditionalServiceById(orderId);
  }

  @Get('/customization/:id')
  async getCustomizationById(@Param('id') orderId: string) {
    return this.orderService.getCustomizationById(orderId);
  }

  @Post('/:clientId')
  async createOrder(
    @Param('clientId') clientId: string,
    @Body() body: CreateOrderDto,
  ) {
    return this.orderService.createOrder(clientId, body);
  }

  @Patch('/:id')
  async updateOrder(@Param('id') id: string, @Body() body: UpdateOrderType) {
    return this.orderService.updateOrder(id, body);
  }

  @Post('/:orderId/license')
  async addLicense(
    @Param('orderId') orderId: string,
    @Body() body: CreateLicenseDto,
  ) {
    return this.orderService.addLicense(orderId, body);
  }

  @Post('/:orderId/additional-service')
  async addAdditionalService(
    @Param('orderId') orderId: string,
    @Body() body: CreateAdditionalServiceDto,
  ) {
    return this.orderService.addAdditionalService(orderId, body);
  }

  @Post('/:orderId/customization')
  async addCustomization(
    @Param('orderId') orderId: string,
    @Body() body: CreateCustomizationDto,
  ) {
    return this.orderService.addCustomization(orderId, body);
  }

  @Patch('/customization/:id')
  async updateCustomizationById(
    @Param('id') id: string,
    @Body() body: CreateCustomizationDto,
  ) {
    return this.orderService.updateCustomizationById(id, body);
  }

  @Patch('/license/:id')
  async updateLicenseById(
    @Param('id') id: string,
    @Body() body: CreateLicenseDto,
  ) {
    return this.orderService.updateLicenseById(id, body);
  }

  @Patch('/additional-service/:id')
  async updateAdditionalServiceById(
    @Param('id') id: string,
    @Body() body: CreateAdditionalServiceDto,
  ) {
    return this.orderService.updateAdditionalServiceById(id, body);
  }

  @Patch('/:orderId/amc')
  async updateAMC(
    @Param('orderId') orderId: string,
    @Body() body: UpdateAMCDto,
  ) {
    return this.orderService.updateAMC(orderId, body);
  }

  @Patch('/pending-payments/:id')
  async updatePendingPaymentStatus(
    @Param('id') id: string,
    @Body() body: UpdatePendingPaymentDto,
  ) {
    return this.orderService.updatePendingPayment(
      id,
      body.type,
      body.payment_identifier,
      {
        payment_receive_date: body.payment_receive_date,
        status: body.status,
      },
    );
  }
}
