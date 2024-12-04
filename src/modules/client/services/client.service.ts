import { Client, ClientDocument } from '@/db/schema/client.schema';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { CreateNewClientDto } from '../dto/create-client.dto';
import { LoggerService } from '@/common/logger/services/logger.service';
import { encrypt } from '@/utils/cryptography';
import { Order, OrderDocument } from '@/db/schema/order/product-order.schema';

@Injectable()
export class ClientService {
  constructor(
    @InjectModel(Client.name)
    private clientModel: SoftDeleteModel<ClientDocument>,
    @InjectModel(Order.name) private orderModel: SoftDeleteModel<OrderDocument>,
    private loggerService: LoggerService,
  ) {}

  async getAllClients(page = 1, limit = 10, fetchAll = false) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getAllClients: Fetching Clients info ',
          page,
          limit,
        }),
      );

      let clients;
      if (fetchAll) {
        clients = await this.clientModel
          .find({ is_parent_company: false })
          .sort({ createdAt: -1 })
          .select('orders name industry createdAt')
          .populate({
            path: 'orders',
            model: 'Order',
            select: 'products',
            populate: {
              path: 'products',
              model: 'Product',
              select: 'name short_name',
            },
          });
      } else {
        clients = await this.clientModel
          .find({ is_parent_company: false })
          .sort({ createdAt: -1 })
          .select('orders name industry createdAt')
          .skip((page - 1) * limit)
          .limit(limit)
          .populate({
            path: 'orders',
            model: 'Order',
            select: 'products',
            populate: {
              path: 'products',
              model: 'Product',
              select: 'name',
            },
          });
      }

      // extract products from the orders and add it in cllient object
      clients = clients.map((client) => {
        let products = [];
        client.orders.map((order) => {
          products = order.products.map((product) => product.name);
        });
        return {
          ...client.toObject(),
          products,
        };
      });

      this.loggerService.warn(
        JSON.stringify({
          message: 'getAllClients: Clients Fetched',
          clients,
        }),
      );

      return clients;
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

  async getAllParentCompanies() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getAllParentCompanies: Fetching Parent Companies',
        }),
      );

      const parentCompanies = await this.clientModel
        .find({
          is_parent_company: true,
        })
        .select('name');

      this.loggerService.warn(
        JSON.stringify({
          message: 'getAllParentCompanies: Parent Companies Fetched',
          parentCompanies,
        }),
      );

      return parentCompanies;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getAllParentCompanies: Failed to get parent companies',
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
      const client = await this.clientModel.findById(id).populate({
        path: 'parent_company_id',
        select: 'name _id',
        model: 'Client',
      });

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

      const clientObj = client.toObject();

      if ((clientObj.parent_company_id as any)?._id) {
        const parent_company = clientObj.parent_company_id as any;
        const parentCompany = {
          id: parent_company._id,
          name: parent_company.name,
        };
        clientObj['parent_company'] = parentCompany;
        delete clientObj.parent_company_id;
      }

      this.loggerService.warn(
        JSON.stringify({
          message: 'getClientById: Client Fetched',
          clientObj,
        }),
      );
      return clientObj;
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
    const { name, client_id, parent_company } = body;

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

      if (parent_company.new && parent_company.name) {
        const parentCompany = new this.clientModel({
          name: parent_company.name,
          is_parent_company: true,
        });
        await parentCompany.save();
        body['parent_company_id'] = parentCompany._id;
        delete body.parent_company;
      } else {
        body['parent_company_id'] = parent_company.id;
        delete body.parent_company;
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
    const { name, pan_number, parent_company, gst_number, vendor_id } = body;

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

      if (parent_company.new && parent_company.name) {
        const parentCompany = new this.clientModel({
          name: parent_company.name,
          is_parent_company: true,
        });
        await parentCompany.save();
        body['parent_company_id'] = parentCompany._id;
        delete body.parent_company;
      } else {
        body['parent_company_id'] = parent_company.id;
        delete body.parent_company;
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

  async getProductsPurchasedByClient(clientId: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message:
            'getProductsPurchasedByClient: Fetching Products purchased by client',
          clientId,
        }),
      );

      const client = await this.clientModel.findById(clientId);

      if (!client) {
        this.loggerService.warn(
          JSON.stringify({
            message: 'getProductsPurchasedByClient: No client found by this ID',
            clientId,
          }),
        );
        throw new HttpException(
          'No client found by this ID',
          HttpStatus.NOT_FOUND,
        );
      }

      const orders = await this.orderModel
        .find({
          _id: { $in: client.orders },
        })
        .populate({
          path: 'products',
          model: 'Product',
        });

      const products = orders.reduce((acc, order) => {
        const productsWithOrderId = order.products.map((product: any) => ({
          ...product._doc,
          order_id: order._id,
        }));
        const uniqueProducts = [...acc];
        productsWithOrderId.forEach((product) => {
          const existingIndex = uniqueProducts.findIndex(
            (p) => p._id.toString() === product._id.toString(),
          );
          if (existingIndex === -1) {
            uniqueProducts.push(product);
          }
        });
        return uniqueProducts;
      }, []);

      this.loggerService.warn(
        JSON.stringify({
          message: 'getProductsPurchasedByClient: Products Fetched',
          products,
        }),
      );

      return products;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getProductsPurchasedByClient: Failed to get products',
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