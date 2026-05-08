import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ClientService } from '../services/client.service';
import { CreateNewClientDto } from '../dto/create-client.dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { INDUSTRIES_ENUM } from '@/common/types/enums/industry.enum';
import { LoggerService } from '@/common/logger/services/logger.service';
import { Response } from 'express';

@Controller('clients')
@UseGuards(AuthGuard)
export class ClientController {
  constructor(
    private clientService: ClientService,
    private loggerService: LoggerService,
  ) { }

  @Get()
  async getAllClients(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('all') all: string,
    @Query('parent_company_id') parentCompanyId?: string,
    @Query('client_name') clientName?: string,
    @Query('industry') industry?: string,
    @Query('product_id') productId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('has_orders') hasOrders?: string,
    @Query('status') status?: string,
    @Query('financial_year') financialYear?: string,
  ) {
    // Ensure valid pagination parameters
    const parsedPage = Math.max(1, parseInt(String(page)) || 1);
    const parsedLimit = Math.min(
      100,
      Math.max(1, parseInt(String(limit)) || 10),
    );
    const fetchAll = String(all).toLowerCase() === 'true';

    const parsedFinancialYear = financialYear ? parseInt(financialYear) : undefined;
    if (financialYear && isNaN(parsedFinancialYear)) {
      throw new HttpException('Invalid financial year', HttpStatus.BAD_REQUEST);
    }

    // Validate industry if provided
    if (industry) {
      const industries = industry.split(',').map((s) => s.trim());
      const invalid = industries.filter(
        (i) => !Object.values(INDUSTRIES_ENUM).includes(i as any),
      );
      if (invalid.length > 0) {
        throw new HttpException('Invalid industry value(s)', HttpStatus.BAD_REQUEST);
      }
    }

    // Basic date validation
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
        message: 'getAllClients: Controller called with filters',
        data: {
          parsedPage,
          parsedLimit,
          fetchAll,
          parentCompanyId,
          clientName,
          industry,
          productId,
          startDate,
          endDate,
          hasOrders,
          status,
          financialYear: parsedFinancialYear,
        },
      }),
    );

    return this.clientService.getAllClients(
      parsedPage,
      parsedLimit,
      fetchAll,
      {
        parentCompanyId,
        clientName,
        industry,
        productId,
        startDate,
        endDate,
        hasOrders,
        status,
        financialYear: parsedFinancialYear,
      },
    );
  }

  @Get('/export')
  async exportClientsToExcel(
    @Query('all') all: string = 'true',
    @Query('parent_company_id') parentCompanyId: string | undefined = undefined,
    @Query('client_name') clientName: string | undefined = undefined,
    @Query('industry') industry: string | undefined = undefined,
    @Query('product_id') productId: string | undefined = undefined,
    @Query('startDate') startDate: string | undefined = undefined,
    @Query('endDate') endDate: string | undefined = undefined,
    @Query('has_orders') hasOrders: string | undefined = undefined,
    @Query('status') status: string | undefined = undefined,
    @Query('financial_year') financialYear: string | undefined = undefined,
    @Res() res: Response,
  ) {
    const fetchAll = String(all).toLowerCase() === 'true';

    const parsedFinancialYear = financialYear ? parseInt(financialYear) : undefined;
    if (financialYear && isNaN(parsedFinancialYear)) {
      throw new HttpException('Invalid financial year', HttpStatus.BAD_REQUEST);
    }

    if (industry) {
      const industries = industry.split(',').map((s) => s.trim());
      const invalid = industries.filter(
        (i) => !Object.values(INDUSTRIES_ENUM).includes(i as any),
      );
      if (invalid.length > 0) {
        throw new HttpException('Invalid industry value(s)', HttpStatus.BAD_REQUEST);
      }
    }

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
        message: 'exportClientsToExcel: Requested client export',
        data: {
          fetchAll,
          parentCompanyId,
          clientName,
          industry,
          productId,
          startDate,
          endDate,
          hasOrders,
          status,
          financialYear: parsedFinancialYear,
        },
      }),
    );

    const excelBuffer = await this.clientService.exportClientsToExcel({
      parentCompanyId,
      clientName,
      industry,
      productId,
      startDate,
      endDate,
      hasOrders,
      status,
      financialYear: parsedFinancialYear,
    });

    const date = new Date().toISOString().split('T')[0];
    const fileName = `Client_Export_${date}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': excelBuffer.length,
    });

    return res.send(excelBuffer);
  }

  @Get('/generate-client-id')
  async generateClientId() {
    return this.clientService.generateUniqueClientId();
  }

  @Get('/stats')
  async getClientStats(
    @Query('parent_company_id') parentCompanyId?: string,
    @Query('client_name') clientName?: string,
    @Query('industry') industry?: string,
    @Query('product_id') productId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('has_orders') hasOrders?: string,
    @Query('financial_year') financialYear?: string,
  ) {
    const parsedFinancialYear = financialYear ? parseInt(financialYear) : undefined;
    if (financialYear && isNaN(parsedFinancialYear)) {
      throw new HttpException('Invalid financial year', HttpStatus.BAD_REQUEST);
    }
    return this.clientService.getClientStats({
      parentCompanyId,
      clientName,
      industry,
      productId,
      startDate,
      endDate,
      hasOrders,
      financialYear: parsedFinancialYear,
    });
  }

  @Get('/check-client-duplicate')
  async checkClientDuplicate(
    @Query('name') name: string,
    @Query('product') product?: string,
    @Query('exclude_id') excludeId?: string,
  ) {
    return this.clientService.checkClientDuplicate(name, product, excludeId);
  }

  @Get('/parent-companies')
  async getAllParentCompanies() {
    return this.clientService.getAllParentCompanies();
  }

  @Get('/:id/products')
  async getProductsPurchasedByClient(@Param('id') clientId: string) {
    return this.clientService.getProductsPurchasedByClient(clientId);
  }

  @Get('/:id/profit')
  async getProfitByClient(@Param('id') clientId: string) {
    return this.clientService.getProfitFromClient(clientId);
  }

  @Get('/:id')
  async getClientById(@Param('id') id: string) {
    return this.clientService.getClientById(id);
  }

  @Post()
  async createNewClient(@Body() body: CreateNewClientDto) {
    return this.clientService.createClient(body);
  }

  @Patch('/:id')
  async updateClient(
    @Param('id') dbClientId: string,
    @Body() body: CreateNewClientDto,
  ) {
    return this.clientService.updateClient(dbClientId, body);
  }

  @Delete('/:id')
  async deleteClient(@Param('id') clientId: string) {
    return this.clientService.deleteClient(clientId);
  }
}
