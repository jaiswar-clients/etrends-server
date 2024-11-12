import { Client } from '@/db/schema/client.schema';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { CreateNewClientDto } from '../dto/create-client.dto';
import { LoggerService } from '@/common/logger/services/logger.service';
import { encrypt } from '@/utils/cryptography';

@Injectable()
export class ClientService {
  constructor(
    @InjectModel(Client.name) private clientModel: SoftDeleteModel<Client>,
    private loggerService: LoggerService,
  ) {}

  
  async getAllClients(page = 1, limit = 10) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getAllClients: Fetching Clients info ',
          page,
          limit,
        }),
      );

      const clients = await this.clientModel
        .find()
        .skip((page - 1) * limit)
        .limit(limit);

      this.loggerService.warn(
        JSON.stringify({
          message: 'getAllClients: Clients Fetched',
          clients,
        }),
      );

      return clients.map((client) => client.toObject());
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getAllClients: Failed to get clients',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message ?? 'Server failed',
        HttpStatus.BAD_GATEWAY,
        {
          cause: error,
        },
      );
    }
  }


  async getClientById(id: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getClientById: Fetching Client info ',
          clienId: id,
        }),
      );
      const client = await this.clientModel.findById(id);

      if (!client) {
        this.loggerService.warn(
          JSON.stringify({
            message: 'getClientById: No Client found by this ID',
            client,
          }),
        );
        throw new HttpException(
          'No Client found by this ID',
          HttpStatus.NOT_FOUND,
        );
      }

      this.loggerService.warn(
        JSON.stringify({
          message: 'getClientById: Client Fetched',
          client,
        }),
      );
      return client.toObject();
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getClientById: Failed to create client',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message ?? 'Server failed',
        HttpStatus.BAD_GATEWAY,
        {
          cause: error,
        },
      );
    }
  }

  async createClient(body: CreateNewClientDto) {
    const { name, client_id } = body;

    this.loggerService.log(
      JSON.stringify({
        message: 'createClient: Initiating client creation process',
        clientName: name,
      }),
    );

    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'createClient: Checking if client already exists',
          client_id,
        }),
      );

      const isClientAlreadyExist = await this.clientModel.findOne({
        client_id,
      });
      if (isClientAlreadyExist) {
        this.loggerService.warn(
          JSON.stringify({
            message: 'createClient: Client already exists with this ID',
            client_id,
          }),
        );
        throw new HttpException(
          'Client already exists with this ID',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'createClient: Creating new client in the database',
          clientName: name,
        }),
      );

      if (body.pan_number) {
        body.pan_number = encrypt(body.pan_number);
      }

      if (body.gst_number) {
        body.gst_number = encrypt(body.gst_number);
      }

      if (body.vendor_id) {
        body.vendor_id = encrypt(body.vendor_id);
      }

      const client = new this.clientModel({
        ...body,
      });

      const savedClient = await client.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'createClient: Client successfully created',
          clientId: savedClient._id,
          clientName: name,
        }),
      );

      return savedClient;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'createClient: Failed to create client',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message ?? 'Server failed',
        HttpStatus.BAD_GATEWAY,
        {
          cause: error,
        },
      );
    }
  }

  async updateClient(dbClientId: string, body: CreateNewClientDto) {
    const { name, pan_number, gst_number, vendor_id } = body;

    this.loggerService.log(
      JSON.stringify({
        message: 'updateClient: Initiating client update process',
        dbClientId,
        clientName: name,
      }),
    );

    try {
      // 1. Check if the client exists
      const client = await this.clientModel.findById(dbClientId);

      if (!client) {
        this.loggerService.warn(
          JSON.stringify({
            message: 'updateClient: Client not found with this ID',
            dbClientId,
          }),
        );
        throw new HttpException(
          'Client not found with this ID',
          HttpStatus.NOT_FOUND,
        );
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'updateClient: Client found, proceeding to update',
          dbClientId,
        }),
      );

      // 2. Encrypt sensitive fields if provided
      if (pan_number) {
        body.pan_number = encrypt(pan_number);
      }

      if (gst_number) {
        body.gst_number = encrypt(gst_number);
      }

      if (vendor_id) {
        body.vendor_id = encrypt(vendor_id);
      }

      // 3. Update the client with new data
      const updatedClient = await this.clientModel.findByIdAndUpdate(
        dbClientId,
        { $set: body },
        { new: true }, // Return the updated client document
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'updateClient: Client successfully updated',
          clientId: updatedClient._id,
          clientName: updatedClient.name,
        }),
      );

      return updatedClient;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'updateClient: Failed to update client',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message ?? 'Server failed',
        HttpStatus.BAD_GATEWAY,
        {
          cause: error,
        },
      );
    }
  }
}
