import { Client, ClientDocument } from '@/db/schema/client.schema';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { CreateNewClientDto } from '../dto/create-client.dto';
import { LoggerService } from '@/common/logger/services/logger.service';
import { encrypt } from '@/utils/cryptography';
import { Order, OrderDocument } from '@/db/schema/order/product-order.schema';
import { AMCDocument, PAYMENT_STATUS_ENUM } from '@/db/schema/amc/amc.schema';
import { Product, ProductDocument } from '@/db/schema/product.schema';
import { INDUSTRIES_ENUM } from '@/common/types/enums/industry.enum';
import { Types } from 'mongoose';

interface ClientFilterOptions {
  parentCompanyId?: string;
  clientName?: string;
  industry?: string;
  productId?: string;
  startDate?: string;
  endDate?: string;
  hasOrders?: string;
}

@Injectable()
export class ClientService {
  constructor(
    @InjectModel(Client.name)
    private clientModel: SoftDeleteModel<ClientDocument>,
    @InjectModel(Order.name) private orderModel: SoftDeleteModel<OrderDocument>,
    @InjectModel(Product.name)
    private productModel: SoftDeleteModel<ProductDocument>,
    private loggerService: LoggerService,
  ) {}

  async getAllClients(
    page = 1,
    limit = 10,
    fetchAll = false,
    filters: ClientFilterOptions = {},
  ): Promise<{
    clients: any[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      pages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    try {
      // Validate industry if provided
      if (
        filters.industry &&
        !Object.values(INDUSTRIES_ENUM).includes(filters.industry as any)
      ) {
        throw new HttpException(
          'Invalid industry value',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate dates
      let parsedStartDate: Date | undefined = undefined;
      let parsedEndDate: Date | undefined = undefined;

      if (filters.startDate && filters.startDate !== 'undefined') {
        parsedStartDate = new Date(filters.startDate);
        if (isNaN(parsedStartDate.getTime())) {
          this.loggerService.error(
            JSON.stringify({
              message: 'getAllClients: Invalid start date format, ignoring',
              startDate: filters.startDate,
            }),
          );
          parsedStartDate = undefined;
        }
      }

      if (filters.endDate && filters.endDate !== 'undefined') {
        parsedEndDate = new Date(filters.endDate);
        if (isNaN(parsedEndDate.getTime())) {
          this.loggerService.error(
            JSON.stringify({
              message: 'getAllClients: Invalid end date format, ignoring',
              endDate: filters.endDate,
            }),
          );
          parsedEndDate = undefined;
        }
      }

      // Validate date range
      if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
        this.loggerService.warn(
          JSON.stringify({
            message:
              'getAllClients: Start date is after end date, date filter will be ignored',
            startDate: parsedStartDate,
            endDate: parsedEndDate,
          }),
        );
        parsedStartDate = undefined;
        parsedEndDate = undefined;
      }

      this.loggerService.log(
        JSON.stringify({
          message:
            'getAllClients: Fetching clients with pagination and filters',
          data: {
            page,
            limit,
            fetchAll,
            filters,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
          },
        }),
      );

      const filterQuery: any = { is_parent_company: false };
      let orderIdsForFilter: Types.ObjectId[] | null = null;

      // Apply date range filter to createdAt
      if (parsedStartDate && parsedEndDate) {
        filterQuery.createdAt = {
          $gte: parsedStartDate,
          $lte: parsedEndDate,
        };
      } else if (parsedStartDate) {
        filterQuery.createdAt = { $gte: parsedStartDate };
      } else if (parsedEndDate) {
        filterQuery.createdAt = { $lte: parsedEndDate };
      }

      // 1. Filter by Client Name
      if (filters.clientName && filters.clientName.trim() !== '') {
        filterQuery.name = { $regex: filters.clientName, $options: 'i' };
      }

      // 2. Filter by Parent Company
      if (filters.parentCompanyId && filters.parentCompanyId.trim() !== '') {
        try {
          const parentCompanyObjectId = new Types.ObjectId(
            filters.parentCompanyId,
          );
          filterQuery.parent_company_id = parentCompanyObjectId;
        } catch (error: any) {
          this.loggerService.error(
            JSON.stringify({
              message:
                'getAllClients: Invalid parent company ID, skipping filter',
              error: error.message,
              parentCompanyId: filters.parentCompanyId,
            }),
          );
        }
      }

      // 3. Filter by Industry
      if (filters.industry && filters.industry.trim() !== '') {
        filterQuery.industry = filters.industry;
      }

      // 4. Filter by Product ID or short_name (find orders first)
      if (filters.productId && filters.productId.trim() !== '') {
        const identifiers = filters.productId.split(',').map((id) => id.trim());
        const objectIds: (Types.ObjectId | string)[] = [];
        const shortNames: string[] = [];

        identifiers.forEach((identifier) => {
          if (Types.ObjectId.isValid(identifier)) {
            objectIds.push(new Types.ObjectId(identifier));
            objectIds.push(identifier);
          } else {
            shortNames.push(identifier);
          }
        });

        if (shortNames.length > 0) {
          const products = await this.productModel
            .find({ short_name: { $in: shortNames } })
            .select('_id')
            .lean<{ _id: Types.ObjectId }[]>();

          products.forEach((product) => {
            objectIds.push(product._id);
            objectIds.push(product._id.toString());
          });
        }

        if (objectIds.length > 0) {
          const ordersWithProducts = await this.orderModel
            .find({ products: { $in: objectIds } })
            .select('_id')
            .lean<{ _id: Types.ObjectId }[]>();

          orderIdsForFilter = ordersWithProducts.map((order) => order._id);

          if (orderIdsForFilter.length === 0) {
            // No orders found with these products
            return {
              clients: [],
              pagination: fetchAll
                ? undefined
                : {
                    total: 0,
                    page,
                    limit,
                    pages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false,
                  },
            };
          }

          filterQuery.orders = { $in: orderIdsForFilter };
        }
      }

      // 5. Filter by hasOrders
      if (filters.hasOrders && filters.hasOrders.trim() !== '') {
        const hasOrdersBoolean = filters.hasOrders.toLowerCase() === 'true';
        if (hasOrdersBoolean) {
          filterQuery.orders = { $exists: true, $ne: [] };
        } else {
          filterQuery.orders = { $exists: false, $eq: [] };
        }
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'getAllClients: Constructed filter query',
          data: filterQuery,
        }),
      );

      // Get total count for pagination (only if not fetchAll)
      let totalClients = 0;
      if (!fetchAll) {
        totalClients = await this.clientModel.countDocuments(filterQuery);

        if (totalClients === 0) {
          this.loggerService.log(
            JSON.stringify({
              message: 'getAllClients: No clients found',
              data: filterQuery,
            }),
          );
          return {
            clients: [],
            pagination: {
              total: 0,
              page,
              limit,
              pages: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          };
        }
      }

      // Build query
      let clientQuery = this.clientModel
        .find(filterQuery)
        .sort({ createdAt: -1 })
        .select('orders name industry createdAt parent_company_id');

      // Apply pagination if not fetchAll
      if (!fetchAll) {
        clientQuery = clientQuery.skip((page - 1) * limit).limit(limit);
      }

      // Execute query with population
      const clients = await clientQuery.populate({
        path: 'orders',
        model: 'Order',
        select: 'products purchased_date',
        populate: {
          path: 'products',
          model: 'Product',
          select: 'name short_name',
        },
      });

      this.loggerService.log(
        JSON.stringify({
          message: 'getAllClients: Clients fetched successfully',
          count: clients.length,
          page,
          limit,
        }),
      );

      // Transform clients data
      const transformedClients = await Promise.all(
        clients.map(async (client: any) => {
          const clientObj = client.toObject();

          // Extract unique products from orders
          const productSet = new Set();
          const products: string[] = [];

          if (client.orders && client.orders.length > 0) {
            client.orders.forEach((order: any) => {
              if (order.products && order.products.length > 0) {
                order.products.forEach((product: any) => {
                  if (
                    product &&
                    product.name &&
                    !productSet.has(product.name)
                  ) {
                    productSet.add(product.name);
                    products.push(product.name);
                  }
                });
              }
            });
          }

          // Get first order date
          let first_order_date = null;
          if (client.orders && client.orders.length > 0) {
            const ordersWithDates = client.orders
              .filter((order: any) => order.purchased_date)
              .sort(
                (a: any, b: any) =>
                  new Date(a.purchased_date).getTime() -
                  new Date(b.purchased_date).getTime(),
              );

            if (ordersWithDates.length > 0) {
              first_order_date = ordersWithDates[0].purchased_date;
            }
          }

          // Get parent company info
          let parent_company = null;
          if (clientObj.parent_company_id) {
            const parentCompany = await this.clientModel
              .findById(clientObj.parent_company_id)
              .select('name')
              .lean();
            parent_company = parentCompany?.name || null;
          }

          return {
            ...clientObj,
            products,
            first_order_date,
            parent_company,
          };
        }),
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'getAllClients: Completed processing clients',
          data: { processedCount: transformedClients.length },
        }),
      );

      const result: any = {
        clients: transformedClients,
      };

      // Add pagination info if not fetchAll
      if (!fetchAll) {
        result.pagination = {
          total: totalClients,
          page,
          limit,
          pages: Math.ceil(totalClients / limit),
          hasNextPage: page < Math.ceil(totalClients / limit),
          hasPreviousPage: page > 1,
        };
      }

      return result;
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
      const client = await this.clientModel.findById(id);
      if (client?.parent_company_id) {
        await client.populate({
          path: 'parent_company_id',
          select: 'name _id',
          model: 'Client',
        });
      }

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
      console.log(error);
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
        .populate([
          {
            path: 'products',
            model: 'Product',
          },
          {
            path: 'amc_id',
            model: 'AMC',
          },
        ]);

      const products = orders.reduce((acc, order) => {
        const productsWithOrderId = order.products.map((product: any) => ({
          ...product._doc,
          order_id: order._id,
          amc_rate: order.amc_rate,
          total_cost: (order.amc_id as any).total_cost,
          cost_per_license: order.cost_per_license,
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

  async getProfitFromClient(clientId: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getProfitFromClient: Getting profits from client',
          clientId,
        }),
      );

      const client = await this.clientModel.findById(clientId);

      if (!client) {
        throw new HttpException('Client not found', HttpStatus.NOT_FOUND);
      }

      const orders = await this.orderModel
        .find({
          _id: { $in: client.orders },
        })
        .populate([
          {
            path: 'customizations',
            model: 'Customization',
          },
          {
            path: 'licenses',
            model: 'License',
          },
          {
            path: 'additional_services',
            model: 'AdditionalService',
          },
          {
            path: 'amc_id',
            model: 'AMC',
          },
          {
            path: 'products',
            model: 'Product',
            select: 'name short_name',
          },
        ]);

      let totalProfit = 0;
      let upcomingAmcProfit = 0;
      let totalAMCCollected = 0;

      // Revenue breakdown
      let revenueBreakdown = {
        base_cost: 0,
        customizations: 0,
        licenses: 0,
        additional_services: 0,
        amc: 0,
      };

      for (const order of orders) {
        // Base order cost
        totalProfit += order.base_cost || 0;
        revenueBreakdown.base_cost += order.base_cost || 0;

        const amc: AMCDocument = order.amc_id as any;

        // Customizations cost
        if (order.customizations?.length) {
          const customizationsCost = order.customizations.reduce(
            (sum: number, customization: any) =>
              sum + (customization.cost || 0),
            0,
          );
          totalProfit += customizationsCost;
          revenueBreakdown.customizations += customizationsCost;
        }

        // Licenses cost
        if (order.licenses?.length) {
          const licensesCost = order.licenses.reduce(
            (sum: number, license: any) =>
              sum + (license.total_license || 0) * (license.rate?.amount || 0),
            0,
          );
          totalProfit += licensesCost;
          revenueBreakdown.licenses += licensesCost;
        }

        // Additional services cost
        if (order.additional_services?.length) {
          const additionalServicesCost = order.additional_services.reduce(
            (sum: number, service: any) => sum + (service.cost || 0),
            0,
          );
          totalProfit += additionalServicesCost;
          revenueBreakdown.additional_services += additionalServicesCost;
        }

        if (amc.payments.length > 1) {
          // exclude first payment as it is free
          const amcPayments = amc.payments.slice(1);
          const totalPaidAmcs = amcPayments.filter(
            (payment) => payment.status === PAYMENT_STATUS_ENUM.PAID,
          ).length;
          const amcCollection = totalPaidAmcs * amc.amount;
          totalAMCCollected += amcCollection;
          revenueBreakdown.amc += amcCollection;
        }
      }

      const formattedOrders = orders.map((order) => ({
        id: order._id,
        products: order.products,
        base_cost: order.base_cost,
        customizations: order.customizations,
        licenses: order.licenses,
        additional_services: order.additional_services,
        amc_details: order.amc_id,

        agreements: order.agreements,
        status: order.status,
        purchased_date: order.purchased_date,
      }));

      return {
        total_profit: totalProfit,
        upcoming_amc_profit: upcomingAmcProfit,
        total_amc_collection: totalAMCCollected,
        revenue_breakdown: revenueBreakdown,
        currency: 'INR',
        orders: formattedOrders,
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getProfitFromClient: Failed to calculate profits',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message ?? 'Failed to calculate profits',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async generateUniqueClientId(): Promise<string> {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'generateUniqueClientId: Generating unique client ID',
        }),
      );

      // Get current year last 2 digits
      const yearSuffix = new Date().getFullYear().toString().slice(-2);

      // Find the latest client with ID pattern for current year
      const latestClient = await this.clientModel
        .findOne({
          client_id: new RegExp(`^CL${yearSuffix}`),
        })
        .sort({ client_id: -1 })
        .select('client_id')
        .lean();

      let nextNumber = 1;
      if (latestClient) {
        // Extract number from existing ID and increment
        const currentNumber = parseInt(latestClient.client_id.slice(-4));
        nextNumber = currentNumber + 1;
      }

      // Generate new ID with 4 digit padding
      const newClientId = `CL${yearSuffix}${nextNumber.toString().padStart(4, '0')}`;

      this.loggerService.log(
        JSON.stringify({
          message:
            'generateUniqueClientId: Generated unique client ID successfully',
          clientId: newClientId,
        }),
      );

      return newClientId;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message:
            'generateUniqueClientId: Failed to generate unique client ID',
          error: error.message,
        }),
      );
      throw new HttpException(
        'Failed to generate unique client ID',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async checkClientNameExists(clientName: string): Promise<{
    exists: boolean;
    clients: any[];
  }> {
    try {
      const normalizedName = clientName.toLowerCase().replace(/\s+/g, '');

      this.loggerService.log(
        JSON.stringify({
          message: 'checkClientNameExists: Checking if client name exists',
          originalName: clientName,
          normalizedName,
        }),
      );

      // Fetch only relevant clients and limit for performance
      const clients = await this.clientModel
        .find({})
        .select('name client_id industry createdAt')
        .lean();

      const filteredClients = clients
        .map((client) => {
          const normalized = client.name.toLowerCase().replace(/\s+/g, '');
          return {
            ...client,
            normalizedName: normalized,
          };
        })
        .filter((client) => client.normalizedName.startsWith(normalizedName))
        .sort((a, b) => {
          // Exact matches first, then alphabetically
          if (a.normalizedName === normalizedName) return -1;
          if (b.normalizedName === normalizedName) return 1;
          return a.normalizedName.localeCompare(b.normalizedName);
        })
        .map(({ normalizedName, ...client }) => client); // Strip temp field

      const exists =
        filteredClients.length > 0 &&
        filteredClients[0].name.toLowerCase().replace(/\s+/g, '') ===
          normalizedName;

      this.loggerService.log(
        JSON.stringify({
          message: 'checkClientNameExists: Client name search completed',
          exists,
          totalResults: filteredClients.length,
          normalizedName,
        }),
      );

      return {
        exists: filteredClients.length > 0,
        clients: filteredClients,
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message:
            'checkClientNameExists: Failed to check client name existence',
          error: error.message,
          stack: error.stack,
          clientName,
        }),
      );

      throw new HttpException(
        error.message ?? 'Failed to check client name existence',
        HttpStatus.BAD_GATEWAY,
        { cause: error },
      );
    }
  }
}
