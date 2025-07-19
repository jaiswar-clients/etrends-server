import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Delete,
  Res,
} from '@nestjs/common';
import { OrderService } from '../services/order.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { CreateLicenseDto } from '../dto/create-license.dto';
import { CreateAdditionalServiceDto } from '../dto/create-additional-service.dto';
import { CreateCustomizationDto } from '../dto/create-customization.service.dto';
import {
  AddAMCPaymentDto,
  UpdateAMCDto,
  UpdateAMCPaymentDto,
} from '../dto/update-amc.dto';
import { AMC_FILTER } from '@/common/types/enums/order.enum';
import { AuthGuard } from '@/common/guards/auth.guard';
import { UpdatePendingPaymentDto } from '../dto/update-pending-payment';
import { LoggerService } from '@/common/logger/services/logger.service';
import { ORDER_STATUS_ENUM } from '@/common/types/enums/order.enum';
import { Response } from 'express';

export type UpdateOrderType = CreateOrderDto;

@Controller('orders')
@UseGuards(AuthGuard)
export class OrderController {
  constructor(
    private orderService: OrderService,
    private loggerService: LoggerService,
  ) {}

  @Get('/all-orders')
  async loadAllOrdersWithAttributes(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('parent_company_id') parentCompanyId?: string,
    @Query('client_id') clientId?: string,
    @Query('client_name') clientName?: string,
    @Query('product_id') productId?: string,
    @Query('status') status?: ORDER_STATUS_ENUM,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Ensure valid pagination parameters
    const parsedPage = Math.max(1, parseInt(String(page)) || 1);
    const parsedLimit = Math.min(
      50,
      Math.max(1, parseInt(String(limit)) || 10),
    );

    // Validate status if provided
    if (status && !Object.values(ORDER_STATUS_ENUM).includes(status)) {
      throw new HttpException('Invalid status value', HttpStatus.BAD_REQUEST);
    }
    
    // Basic date validation (more thorough validation in service)
    if (startDate && isNaN(new Date(startDate).getTime())) {
      throw new HttpException('Invalid start date format', HttpStatus.BAD_REQUEST);
    }
    if (endDate && isNaN(new Date(endDate).getTime())) {
      throw new HttpException('Invalid end date format', HttpStatus.BAD_REQUEST);
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new HttpException('Start date cannot be after end date', HttpStatus.BAD_REQUEST);
    }

    this.loggerService.log(
      JSON.stringify({
        message: 'loadAllOrdersWithAttributes: Controller called',
        data: {
          parsedPage,
          parsedLimit,
          parentCompanyId,
          clientId,
          clientName,
          productId,
          status,
          startDate,
          endDate,
        },
      }),
    );

    return this.orderService.loadAllOrdersWithAttributes(
      parsedPage,
      parsedLimit,
      {
        parentCompanyId,
        clientId,
        clientName,
        productId,
        status,
        startDate,
        endDate,
      },
    );
  }

  @Get('/filters/company-data')
  async getCompanyFilterData() {
    this.loggerService.log(
      JSON.stringify({
        message: 'getCompanyFilterData: Controller called',
      }),
    );
    return this.orderService.getCompanyFilterData();
  }

  @Get('/all-amc')
  async loadAllAMC(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('filter') filter: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('client_id') clientId: string,
    @Query('product_id') productId: string,
  ) {
    // Validate and parse pagination
    const parsedPage = Math.max(1, parseInt(page?.toString() || '1'));
    const parsedLimit = Math.min(
      100,
      Math.max(1, parseInt(limit?.toString() || '10')),
    );

    // Validate dates
    let parsedStartDate: Date | undefined = undefined;
    let parsedEndDate: Date | undefined = undefined;

    if (startDate && startDate !== 'undefined') {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        throw new HttpException(
          'Invalid start date format',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (endDate && endDate !== 'undefined') {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        throw new HttpException(
          'Invalid end date format',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Validate date range
    if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
      throw new HttpException(
        'Start date cannot be after end date',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Parse filter values (support for multiple comma-separated values)
    let filterValues: AMC_FILTER[] = [];
    if (filter) {
      filterValues = filter
        .split(',')
        .map((f) => f.trim().toLowerCase() as AMC_FILTER);

      // Validate that all filter values are valid
      const validFilters = Object.values(AMC_FILTER);
      const invalidFilters = filterValues.filter(
        (f) => !validFilters.includes(f as AMC_FILTER),
      );

      if (invalidFilters.length > 0) {
        throw new HttpException(
          `Invalid filter value(s): ${invalidFilters.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Default to pending if no filter provided
    if (filterValues.length === 0) {
      filterValues = [AMC_FILTER.PENDING];
    }

    return this.orderService.loadAllAMC(parsedPage, parsedLimit, filterValues, {
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      clientId,
      productId,
    });
  }

  @Get('/export-amc')
  async exportAmcToExcel(
    @Query('filter') filter: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('client_id') clientId: string,
    @Query('product_id') productId: string,
    @Res() res: Response,
  ) {
    // Validate dates
    let parsedStartDate: Date | undefined = undefined;
    let parsedEndDate: Date | undefined = undefined;

    if (startDate && startDate !== 'undefined') {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        throw new HttpException(
          'Invalid start date format',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (endDate && endDate !== 'undefined') {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        throw new HttpException(
          'Invalid end date format',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Validate date range
    if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
      throw new HttpException(
        'Start date cannot be after end date',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Parse filter values (support for multiple comma-separated values)
    let filterValues: AMC_FILTER[] = [];
    if (filter) {
      filterValues = filter
        .split(',')
        .map((f) => f.trim().toLowerCase() as AMC_FILTER);

      // Validate that all filter values are valid
      const validFilters = Object.values(AMC_FILTER);
      const invalidFilters = filterValues.filter(
        (f) => !validFilters.includes(f as AMC_FILTER),
      );

      if (invalidFilters.length > 0) {
        throw new HttpException(
          `Invalid filter value(s): ${invalidFilters.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Default to pending if no filter provided
    if (filterValues.length === 0) {
      filterValues = [AMC_FILTER.PENDING];
    }

    // Log the export request
    this.loggerService.log(
      JSON.stringify({
        message: 'exportAmcToExcel: Requested AMC export',
        filters: filterValues,
        dateRange: { startDate: parsedStartDate, endDate: parsedEndDate },
        clientId,
        productId,
      }),
    );

    // Generate Excel buffer
    const excelBuffer = await this.orderService.exportAmcToExcel(filterValues, {
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      clientId,
      productId,
    });

    // Set headers for file download
    const date = new Date().toISOString().split('T')[0];
    const filtersString = filterValues.length > 0 ? filterValues.join('_') : 'all';
    const fileName = `AMC_Export_${filtersString}_${date}.xlsx`;
    
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': excelBuffer.length,
    });

    // Send the file
    return res.send(excelBuffer);
  }

  @Get('/export-purchases')
  async exportPurchasesToExcel(
    @Query('parent_company_id') parentCompanyId?: string,
    @Query('client_id') clientId?: string,
    @Query('client_name') clientName?: string,
    @Query('product_id') productId?: string,
    @Query('status') status?: ORDER_STATUS_ENUM,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() res?: Response,
  ) {
    // Validate status if provided
    if (status && !Object.values(ORDER_STATUS_ENUM).includes(status)) {
      throw new HttpException('Invalid status value', HttpStatus.BAD_REQUEST);
    }

    // Validate dates
    let parsedStartDate: Date | undefined = undefined;
    let parsedEndDate: Date | undefined = undefined;

    if (startDate && startDate !== 'undefined') {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        throw new HttpException(
          'Invalid start date format',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (endDate && endDate !== 'undefined') {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        throw new HttpException(
          'Invalid end date format',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Validate date range
    if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
      throw new HttpException(
        'Start date cannot be after end date',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.loggerService.log(
      JSON.stringify({
        message: 'exportPurchasesToExcel: Requested Purchases export',
        filters: {
          parentCompanyId,
          clientId,
          clientName,
          productId,
          status,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
        },
      }),
    );

    // Generate Excel buffer
    const excelBuffer = await this.orderService.exportPurchasesToExcel({
      parentCompanyId,
      clientId,
      clientName,
      productId,
      status,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    });

    // Set headers for file download
    const date = new Date().toISOString().split('T')[0];
    const fileName = `Purchases_Export_${date}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': excelBuffer.length,
    });

    // Send the file
    return res.send(excelBuffer);
  }

  @Get('/pending-payments')
  async getAllPendingPayments(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('clientId') clientId?: string,
    @Query('clientName') clientName?: string,
    @Query('type') type?: 'order' | 'amc' | 'all',
  ) {
    // Ensure page and limit are positive integers, defaulting if necessary
    const finalPage = Math.max(1, page || 1);
    const finalLimit = Math.max(1, limit || 20);

    this.loggerService.log(
      JSON.stringify({
        message: 'getAllPendingPayments: Controller called',
        data: { page: finalPage, limit: finalLimit, startDate, endDate, clientId, clientName, type },
      }),
    );
    return this.orderService.getAllPendingPayments(finalPage, finalLimit, {
      startDate,
      endDate,
      clientId,
      clientName,
      type,
    });
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

  @Get('/amc-payments-review/:id')
  async getAmcReviewByOrderId(@Param('id') orderId: string) {
    return this.orderService.getAmcReviewByOrderId(orderId);
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

  @Patch('/amc/:id')
  async updateAMCById(@Param('id') id: string, @Body() body: UpdateAMCDto) {
    return this.orderService.updateAMCById(id, body);
  }

  @Patch('/amc/:id/payments')
  async addPaymentsIntoAMC(
    @Param('id') amcId: string,
    @Body() body: AddAMCPaymentDto[],
  ) {
    return this.orderService.addPaymentsIntoAmc(amcId, body);
  }

  @Patch('/amc/:id/payment/:paymentId')
  async updateAMCPaymentById(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Body() body: UpdateAMCPaymentDto,
  ) {
    return this.orderService.updateAmcPaymentById(id, paymentId, body);
  }

  @Delete('/amc/:id/payment/:paymentId')
  async deleteAMCPaymentById(
    @Param('id') amcId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.orderService.deleteAmcPaymentById(amcId, paymentId);
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

  @Delete('/:id')
  async deleteOrderById(@Param('id') id: string) {
    return this.orderService.deleteOrderById(id);
  }


  @Post('/amc/:id/update-amc-payments')
  async createAmcPayments(@Param('id') id: string, @Body() body: { till_year: number }) {
    console.log(body);
    return this.orderService.createAmcPaymentsTillYear(id, body.till_year);
  }

  @Post('/amc/update-amc-payments-for-all-amcs')
  async createAmcPaymentsForAllAmcs(@Body() body: { till_year: number }) {
    return this.orderService.createAmcPaymentsTillYearForAllAmcs(body.till_year);
  }
}
