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
import { ClientService } from '../services/client.service';
import { CreateNewClientDto } from '../dto/create-client.dto';
import { AuthGuard } from '@/common/guards/auth.guard';

@Controller('clients')
@UseGuards(AuthGuard)
export class ClientController {
  constructor(private clientService: ClientService) {}

  @Get()
  async getAllClients(
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const parsedPage = parseInt(page as string, 10);
    const parsedLimit = parseInt(limit as string, 10);
    return this.clientService.getAllClients(parsedPage, parsedLimit);
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
