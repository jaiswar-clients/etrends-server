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
} from '@nestjs/common';
import { ClientService } from '../services/client.service';
import { CreateNewClientDto } from '../dto/create-client.dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { INDUSTRIES_ENUM } from '@/common/types/enums/industry.enum';
import { LoggerService } from '@/common/logger/services/logger.service';

@Controller('clients')
@UseGuards(AuthGuard)
export class ClientController {
  constructor(
    private clientService: ClientService,
    private loggerService: LoggerService,
  ) {}
  
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
  ) {
    // Ensure valid pagination parameters
    const parsedPage = Math.max(1, parseInt(String(page)) || 1);
    const parsedLimit = Math.min(
      50,
      Math.max(1, parseInt(String(limit)) || 10),
    );
    const fetchAll = Boolean(all);

    // Validate industry if provided
    if (industry && !Object.values(INDUSTRIES_ENUM).includes(industry as any)) {
      throw new HttpException('Invalid industry value', HttpStatus.BAD_REQUEST);
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
      },
    );
  }

  @Get('/generate-client-id')
  async generateClientId() {
    return this.clientService.generateUniqueClientId();
  }

  @Get('/check-client-name')
  async checkClientName(@Query('name') name: string) {
    return this.clientService.checkClientNameExists(name);
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
}
