import {
  Customization,
  CustomizationDocument,
} from '@/db/schema/order/customization.schema';
import { License, LicenseDocument } from '@/db/schema/order/license.schema';
import { Order, OrderDocument } from '@/db/schema/order/product-order.schema';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { CreateOrderDto } from '../dto/create-order.dto';
import { Product, ProductDocument } from '@/db/schema/product.schema';
import { LoggerService } from '@/common/logger/services/logger.service';
import { Client, ClientDocument } from '@/db/schema/client.schema';
import { StorageService } from '@/common/storage/services/storage.service';
import { CreateLicenseDto } from '../dto/create-license.dto';
import {
  AdditionalService,
  AdditionalServiceDocument,
} from '@/db/schema/order/additional-service.schema';
import { CreateAdditionalServiceDto } from '../dto/create-additional-service.dto';
import { CreateCustomizationDto } from '../dto/create-customization.service.dto';
import {
  AMC_FILTER,
  DEFAULT_AMC_CYCLE_IN_MONTHS,
  PURCHASE_TYPE,
  ORDER_STATUS_ENUM,
} from '@/common/types/enums/order.enum';
import {
  AMC,
  AMCDocument,
  PAYMENT_STATUS_ENUM,
} from '@/db/schema/amc/amc.schema';
import { Types } from 'mongoose';
import {
  AddAMCPaymentDto,
  UpdateAMCDto,
  UpdateAMCPaymentDto,
} from '../dto/update-amc.dto';
import { extractFileKey } from '@/utils/misc';
import { IPendingPaymentTypes } from '../dto/update-pending-payment';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Reminder,
  ReminderDocument,
} from '@/db/schema/reminders/reminder.schema';
import { isSameDay } from 'date-fns';
import * as ExcelJS from 'exceljs';

// Define filter options structure
interface OrderFilterOptions {
  parentCompanyId?: string;
  clientId?: string;
  clientName?: string;
  productId?: string;
  status?: ORDER_STATUS_ENUM;
  startDate?: string | Date;
  endDate?: string | Date;
}

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name)
    private orderModel: SoftDeleteModel<OrderDocument>,
    @InjectModel(License.name)
    private licenseModel: SoftDeleteModel<LicenseDocument>,
    @InjectModel(Customization.name)
    private customizationModel: SoftDeleteModel<CustomizationDocument>,
    @InjectModel(Product.name)
    private productModel: SoftDeleteModel<ProductDocument>,
    @InjectModel(Client.name)
    private clientModel: SoftDeleteModel<ClientDocument>,
    @InjectModel(AdditionalService.name)
    private additionalServiceModel: SoftDeleteModel<AdditionalServiceDocument>,
    @InjectModel(AMC.name)
    private amcModel: SoftDeleteModel<AMCDocument>,
    @InjectModel(Reminder.name)
    private reminderModel: SoftDeleteModel<ReminderDocument>,
    private loggerService: LoggerService,
    private storageService: StorageService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async createOrder(clientId: string, body: CreateOrderDto) {
    if (!clientId) {
      this.loggerService.error(
        JSON.stringify({
          message: 'createOrder: Client id is required',
        }),
      );
      throw new HttpException('Client id is required', HttpStatus.BAD_REQUEST);
    }
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'createOrder: Creating new order',
        }),
      );

      const client = await this.clientModel
        .findById(clientId)
        .select('amc_frequency_in_months');

      if (!client) {
        this.loggerService.error(
          JSON.stringify({
            message: 'createOrder: Client not found',
          }),
        );
        throw new HttpException('Client not found', HttpStatus.NOT_FOUND);
      }

      const { products } = body;

      const productsList = await this.productModel.find({
        _id: { $in: products },
      });

      this.loggerService.log(
        JSON.stringify({
          message: 'createOrder: Found products',
          productsList,
        }),
      );

      if (productsList.length !== products.length) {
        throw new Error('Invalid product id');
      }

      const orderPayload = {
        ...body,
        client_id: clientId,
        purchase_date: new Date(body.purchased_date),
      };

      this.loggerService.log(
        JSON.stringify({
          message: 'createOrder: Creating order',
          orderPayload,
        }),
      );

      const order = new this.orderModel(orderPayload);

      // AMC Creation

      // calculate amc_percentage if order.amc_rate.amount is present
      let amcPercentage = order.amc_rate.percentage;

      const amcTotalCost = order.base_cost;

      const amcAmount = (amcTotalCost / 100) * amcPercentage;

      this.loggerService.log(
        JSON.stringify({
          message: 'createOrder: Creating AMC',
          amcTotalCost,
          amcAmount,
          amcPercentage,
        }),
      );

      const amc = new this.amcModel({
        order_id: order._id,
        client_id: clientId,
        total_cost: amcTotalCost,
        amount: amcAmount,
        products: products,
        amc_percentage: amcPercentage,
        start_date: body.amc_start_date
          ? new Date(body.amc_start_date)
          : undefined,
        payments: [],
      });

      await amc.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'createOrder: AMC created',
          amc_id: amc._id,
        }),
      );

      order.amc_id = new Types.ObjectId(amc._id.toString());
      await order.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'createOrder: Order created successfully',
          order_id: order._id,
        }),
      );

      // Use findOneAndUpdate with upsert to handle both cases in a single query
      const updatedClient = await this.clientModel.findOneAndUpdate(
        { _id: clientId },
        {
          $push: { orders: order._id, amcs: amc._id },
        },
        { new: true },
      );

      if (!updatedClient) {
        throw new Error('Client not found');
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'createOrder: Updated client orders',
          client_id: clientId,
          order_id: order._id,
          updated_client: updatedClient,
        }),
      );

      return order;
    } catch (error: any) {
      console.log({ error });
      this.loggerService.error(
        JSON.stringify({
          message: 'createOrder: Error creating order',
          error: error.message,
        }),
      );
      throw new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Create Update handler for first order
  async updateOrder(orderId: string, body: CreateOrderDto) {
    if (!orderId) {
      this.loggerService.error(
        JSON.stringify({
          message: 'updateFirstOrder: Order id is required',
        }),
      );
      throw new HttpException('Order id is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const existingOrder = await this.orderModel.findById(orderId).populate({
        path: 'amc_id',
        model: AMC.name,
      });
      if (!existingOrder) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      const { products } = body;

      const productsList = await this.productModel.find({
        _id: { $in: products },
      });

      if (productsList.length !== products.length) {
        throw new Error('Invalid product id');
      }

      const orderPayload = {
        ...body,
      };

      if (orderPayload.payment_terms.length) {
        orderPayload.payment_terms.map((term) => {
          term.invoice_document = extractFileKey(term.invoice_document);
          return term;
        });
      }

      orderPayload.purchase_order_document = extractFileKey(
        orderPayload.purchase_order_document,
      );

      if (orderPayload.other_documents.length) {
        orderPayload.other_documents = orderPayload.other_documents.map(
          (doc) => {
            doc.url = extractFileKey(doc.url);
            return doc;
          },
        );
      }

      orderPayload.agreements.map((agreement) => {
        agreement.document = extractFileKey(agreement.document);
        return agreement;
      });

      const updatedOrder = await this.orderModel.findByIdAndUpdate(
        orderId,
        orderPayload,
        { new: true },
      );

      const amcTotalCost = updatedOrder.base_cost;
      let amcPercentage = updatedOrder.amc_rate?.percentage || 0;

      const amcAmount = (amcTotalCost / 100) * amcPercentage;

      /**
       * TODO: TEST THE FLOW OF AMC PAYMENTS
       */
      if (updatedOrder.amc_id) {
        const amc = await this.amcModel.findById(updatedOrder.amc_id).populate({
          path: 'client_id',
          select: 'amc_frequency_in_months',
        });

        let payments = amc?.payments || [];

        // Handle payments update for date/frequency changes
        if (
          body?.amc_start_date?.toString() !==
            existingOrder?.amc_start_date?.toString() &&
          payments.length
        ) {
          this.loggerService.log(
            JSON.stringify({
              message: 'updateAMC: Start date has changed',
              previousStartDate: existingOrder.amc_start_date,
              newStartDate: body.amc_start_date,
            }),
          );

          const payments = [...amc.payments];
          const lastPayment = payments[payments.length - 1];
          const secondLastPayment = payments[payments.length - 2];

          // Only update if last payment is pending
          if (
            lastPayment &&
            lastPayment.status === PAYMENT_STATUS_ENUM.PENDING
          ) {
            this.loggerService.log(
              JSON.stringify({
                message:
                  'updateAMC: Last payment is pending, updating payment dates',
                lastPayment,
                secondLastPayment,
              }),
            );

            const amc_frequency_in_months =
              (amc.client_id as any)?.amc_frequency_in_months ||
              DEFAULT_AMC_CYCLE_IN_MONTHS;

            let fromDate;
            if (secondLastPayment) {
              // If there's a second last payment, use its to_date as fromDate
              fromDate = secondLastPayment.to_date;
              this.loggerService.log(
                JSON.stringify({
                  message:
                    'updateAMC: Using second last payment to_date as fromDate',
                  fromDate,
                }),
              );
            } else {
              // Otherwise find the last paid payment or use start_date
              const lastPaidPayment = [...payments]
                .slice(0, -1)
                .reverse()
                .find((p) => p.status === PAYMENT_STATUS_ENUM.PAID);
              fromDate = lastPaidPayment
                ? lastPaidPayment.to_date
                : body.amc_start_date;
              this.loggerService.log(
                JSON.stringify({
                  message:
                    'updateAMC: No second last payment found, using last paid payment or start_date',
                  fromDate,
                }),
              );
            }

            lastPayment.from_date = fromDate;
            lastPayment.to_date = this.getNextDate(
              new Date(fromDate),
              amc_frequency_in_months,
            );
            this.loggerService.log(
              JSON.stringify({
                message: 'updateAMC: Updated last payment dates',
                lastPayment,
              }),
            );
          }

          amc.payments = payments;
          await amc.save();
        }

        await this.amcModel.findByIdAndUpdate(updatedOrder.amc_id, {
          total_cost: amcTotalCost,
          amount: amcAmount,
          products: products,
          amc_percentage: amcPercentage,
          start_date: body.amc_start_date
            ? new Date(body.amc_start_date)
            : undefined,
          payments,
        });
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'updateFirstOrder: Order updated successfully',
          order_id: updatedOrder._id,
        }),
      );

      return updatedOrder;
    } catch (error: any) {
      console.log({ error });
      this.loggerService.error(
        JSON.stringify({
          message: 'updateFirstOrder: Error updating order',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getOrderById(orderId: string) {
    if (!orderId) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getOrderById: Order id is required',
        }),
      );
      throw new HttpException('Order id is required', HttpStatus.BAD_REQUEST);
    }

    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getOrderById: Fetching order',
          orderId,
        }),
      );

      const order = await this.orderModel
        .findById(orderId)
        .populate([{ path: 'customizations', model: Customization.name }])
        .populate({ path: 'amc_id', select: 'amount', model: AMC.name });

      if (!order) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getOrderById: Order not found',
            orderId,
          }),
        );
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      const orderObj = order.toObject();

      this.loggerService.log(
        JSON.stringify({
          message: 'getOrderById: Order found successfully',
          orderId: order._id,
        }),
      );

      if (orderObj.purchase_order_document) {
        orderObj.purchase_order_document = this.storageService.get(
          orderObj.purchase_order_document,
        );
      }

      orderObj.payment_terms.map((term) => {
        term.invoice_document = this.storageService.get(term.invoice_document);
        return term;
      });

      if (orderObj.other_documents.length) {
        orderObj.other_documents = orderObj.other_documents.map((doc) => {
          doc.url = this.storageService.get(doc.url);
          return doc;
        });
      }

      if (orderObj.agreements.length) {
        for (let i = 0; i < orderObj.agreements.length; i++) {
          orderObj.agreements[i].document = this.storageService.get(
            orderObj.agreements[i].document,
          );
        }
      }

      if (orderObj.amc_id) {
        orderObj['amc_amount'] = (orderObj.amc_id as any).amount;
        delete orderObj.amc_id;
      }

      return orderObj;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getOrderById: Error fetching order',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getOrdersByClientId(clientId: string) {
    if (!clientId) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getOrdersByClientId: Client id is required',
        }),
      );
      throw new HttpException('Client id is required', HttpStatus.BAD_REQUEST);
    }

    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getOrdersByClientId: Fetching client orders',
          clientId,
        }),
      );

      const client = await this.clientModel.findById(clientId);
      if (!client) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getOrdersByClientId: Client not found',
            clientId,
          }),
        );
        throw new HttpException('Client not found', HttpStatus.NOT_FOUND);
      }

      const orders = await this.orderModel
        .find({ _id: { $in: client.orders } })
        .populate([
          { path: 'license_id', model: License.name },
          { path: 'customization_id', model: Customization.name },
          { path: 'products', model: Product.name },
        ]);

      const ordersList = orders.map((order) => {
        const orderObj = order.toObject();
        if (orderObj.licenses && orderObj.licenses.length > 0) {
          orderObj['license'] = orderObj.licenses[0];
          delete orderObj.licenses;
        }
        if (orderObj.customizations && orderObj.customizations.length > 0) {
          orderObj['customization'] = orderObj.customizations[0];
          delete orderObj.customizations;
        }
        if (orderObj.purchase_order_document) {
          orderObj.purchase_order_document = this.storageService.get(
            orderObj.purchase_order_document,
          );
        }
        if (orderObj.agreements.length) {
          for (let i = 0; i < orderObj.agreements.length; i++) {
            orderObj.agreements[i].document = this.storageService.get(
              orderObj.agreements[i].document,
            );
          }
        }
        return orderObj;
      });

      this.loggerService.log(
        JSON.stringify({
          message: 'getOrdersByClientId: Orders fetched successfully',
          clientId,
          orders: ordersList,
        }),
      );

      return ordersList;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getOrdersByClientId: Error fetching client orders',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // License section
  async addLicense(orderId: string, body: CreateLicenseDto) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'createLicense: Creating new license',
          body,
        }),
      );

      const { cost_per_license, total_license, product_id } = body;

      const license = new this.licenseModel({
        rate: {
          amount: cost_per_license,
          percentage: 0,
        },
        total_license,
        product_id,
        order_id: orderId,
        purchase_date: body.purchase_date,
        purchase_order_document: body.purchase_order_document,
        invoice_document: body.invoice_document,
      });
      await license.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'createLicense: License created successfully',
          license_id: license._id,
        }),
      );

      const cost = cost_per_license * total_license;

      // Add customization cost to AMC total cost
      const amc = await this.amcModel.findOne({
        order_id: new Types.ObjectId(orderId),
      });
      if (!amc) {
        throw new Error('AMC not found for this order');
      }

      const newTotalCost = amc.total_cost + cost;
      const newAmount = (newTotalCost / 100) * amc.amc_percentage;

      this.loggerService.log(
        JSON.stringify({
          message: 'addCustomization: AMC Calc completed',
          newTotalCost,
          newAmount,
          used: { percentage: amc.amc_percentage, total_cost: amc.total_cost },
        }),
      );

      const amcUpdateResult = await this.amcModel.findByIdAndUpdate(
        amc._id,
        {
          total_cost: newTotalCost,
          amount: newAmount,
        },
        { new: true },
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'addCustomization: AMC update completed',
          amcUpdateResult,
          orderId,
        }),
      );

      await this.orderModel.findByIdAndUpdate(orderId, {
        $push: { licenses: license._id },
      });

      return license;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'createLicense: Error creating license',
          error: error.message,
        }),
      );
      throw new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Additional Service
  async addAdditionalService(
    orderId: string,
    body: CreateAdditionalServiceDto,
  ) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'addAdditionalService: Creating new additional service',
          body,
        }),
      );

      const additionalService = new this.additionalServiceModel({
        ...body,
        order_id: orderId,
      });
      await additionalService.save();

      this.loggerService.log(
        JSON.stringify({
          message:
            'addAdditionalService: Additional service created successfully',
          additional_service_id: additionalService._id,
        }),
      );

      await this.orderModel.findByIdAndUpdate(orderId, {
        $push: { additional_services: additionalService._id },
      });

      return additionalService;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'addAdditionalService: Error creating additional service',
          error: error.message,
        }),
      );
      throw new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Customization
  async addCustomization(orderId: string, body: CreateCustomizationDto) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'addCustomization: Starting customization creation',
          orderId,
          body,
        }),
      );

      const { cost, modules, product_id } = body;

      this.loggerService.log(
        JSON.stringify({
          message: 'addCustomization: Creating customization document',
          cost,
          modules,
          product_id,
          orderId,
        }),
      );

      const customization = new this.customizationModel({
        ...body,
        order_id: orderId,
      });
      await customization.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'addCustomization: Starting AMC cost update',
          orderId,
          customizationId: customization._id,
          customizationCost: cost,
        }),
      );

      // Add customization cost to AMC total cost
      const amc = await this.amcModel.findOne({
        order_id: new Types.ObjectId(orderId),
      });
      if (!amc) {
        throw new Error('AMC not found for this order');
      }

      const newTotalCost = amc.total_cost + cost;
      const newAmount = (newTotalCost / 100) * amc.amc_percentage;

      this.loggerService.log(
        JSON.stringify({
          message: 'addCustomization: AMC Calc completed',
          newTotalCost,
          newAmount,
          used: { percentage: amc.amc_percentage, total_cost: amc.total_cost },
        }),
      );

      const amcUpdateResult = await this.amcModel.findByIdAndUpdate(
        amc._id,
        {
          total_cost: newTotalCost,
          amount: newAmount,
        },
        { new: true },
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'addCustomization: AMC update completed',
          amcUpdateResult,
          orderId,
        }),
      );

      const orderUpdate = await this.orderModel.findByIdAndUpdate(orderId, {
        $push: { customizations: customization._id },
      });

      this.loggerService.log(
        JSON.stringify({
          message: 'addCustomization: Process completed successfully',
          customizationId: customization._id,
          orderId,
          orderUpdateResult: orderUpdate,
        }),
      );

      return customization;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'addCustomization: Error occurred',
          error: error.message,
          stack: error.stack,
          orderId,
          requestBody: body,
        }),
      );
      throw new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async loadAllOrdersWithAttributes(
    page: number,
    limit: number,
    filters: OrderFilterOptions = {},
  ): Promise<{
    purchases: any[]; // Use any[] for simplicity here
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    // Removed clientCompanies and parentCompanies from return type
  }> {
    try {
      // Validate status if provided
      if (
        filters.status &&
        !Object.values(ORDER_STATUS_ENUM).includes(filters.status)
      ) {
        throw new HttpException('Invalid status value', HttpStatus.BAD_REQUEST);
      }

      // Validate dates
      let parsedStartDate: Date | undefined = undefined;
      let parsedEndDate: Date | undefined = undefined;

      if (filters.startDate && filters.startDate !== 'undefined') {
        parsedStartDate = new Date(filters.startDate);
        if (isNaN(parsedStartDate.getTime())) {
          this.loggerService.error(
            JSON.stringify({
              message:
                'loadAllOrdersWithAttributes: Invalid start date format, ignoring',
              startDate: filters.startDate,
            }),
          );
          parsedStartDate = undefined; // Ignore invalid date
        }
      }

      if (filters.endDate && filters.endDate !== 'undefined') {
        parsedEndDate = new Date(filters.endDate);
        if (isNaN(parsedEndDate.getTime())) {
          this.loggerService.error(
            JSON.stringify({
              message:
                'loadAllOrdersWithAttributes: Invalid end date format, ignoring',
              endDate: filters.endDate,
            }),
          );
          parsedEndDate = undefined; // Ignore invalid date
        }
      }

      // Validate date range
      if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
        // If range is invalid, perhaps log and ignore, or throw error
        // For now, let's log and proceed without date filtering to avoid breaking existing functionality
        this.loggerService.warn(
          JSON.stringify({
            message:
              'loadAllOrdersWithAttributes: Start date is after end date, date filter will be ignored',
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
            'loadAllOrdersWithAttributes: Fetching orders with pagination and filters',
          data: {
            page,
            limit,
            filters,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
          },
        }),
      );

      const skip = (page - 1) * limit;
      const filterQuery: any = {};
      let clientIdsForFilter: Types.ObjectId[] | null = null; // Explicitly type

      // Apply date range filter to purchase_date
      if (parsedStartDate && parsedEndDate) {
        filterQuery.purchased_date = {
          $gte: parsedStartDate,
          $lte: parsedEndDate,
        };
      } else if (parsedStartDate) {
        filterQuery.purchased_date = { $gte: parsedStartDate };
      } else if (parsedEndDate) {
        filterQuery.purchased_date = { $lte: parsedEndDate };
      }

      // --- Build Filter Query ---
      // // 1. Filter by Client Name (find client IDs first)
      if (filters.clientName && filters.clientName.trim() !== '') {
        const clientsByName = await this.clientModel
          .find({
            name: { $regex: filters.clientName, $options: 'i' },
          })
          .select('_id')
          .lean<{ _id: Types.ObjectId }[]>(); // Add lean type hint
        clientIdsForFilter = clientsByName.map((c) => c._id); // Now correctly typed
        // If no clients match the name, no orders will be found
        if (clientIdsForFilter.length === 0) {
          return {
            purchases: [],
            pagination: {
              total: 0,
              page,
              limit,
              pages: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          }; // Removed company arrays
        }
        filterQuery.client_id = { $in: clientIdsForFilter };
      }

      // 2. Filter by Parent Company (find client IDs first)
      if (filters.parentCompanyId && filters.parentCompanyId.trim() !== '') {
        try {
          const parentCompanyObjectId = new Types.ObjectId(
            filters.parentCompanyId,
          );
          const childClients = await this.clientModel
            .find({
              parent_company_id: parentCompanyObjectId,
            })
            .select('_id')
            .lean<{ _id: Types.ObjectId }[]>(); // Add lean type hint

          const childClientIds: Types.ObjectId[] = childClients.map(
            (c) => c._id,
          ); // Explicitly type

          // Combine with existing client ID filter if necessary
          if (
            filterQuery.client_id &&
            filterQuery.client_id.$in &&
            Array.isArray(filterQuery.client_id.$in)
          ) {
            // Ensure the items in $in are ObjectIds before filtering
            const existingClientIds = filterQuery.client_id.$in
              .map((id) =>
                id instanceof Types.ObjectId
                  ? id
                  : Types.ObjectId.isValid(id)
                    ? new Types.ObjectId(id)
                    : null,
              )
              .filter((id) => id !== null);

            // Intersect IDs from clientName filter and parentCompany filter
            clientIdsForFilter = existingClientIds.filter(
              (id: Types.ObjectId) =>
                childClientIds.some((childId) => childId.equals(id)), // Now compares ObjectId correctly
            );
          } else {
            clientIdsForFilter = childClientIds;
          }

          // If no clients match the combined filter, assign an impossible condition to ensure no results
          if (clientIdsForFilter.length === 0) {
            filterQuery.client_id = { $in: [] }; // No clients match combination
          } else {
            filterQuery.client_id = { $in: clientIdsForFilter };
          }
        } catch (error: any) {
          this.loggerService.error(
            JSON.stringify({
              message:
                'loadAllOrdersWithAttributes: Invalid parent company ID, skipping filter',
              error: error.message,
              parentCompanyId: filters.parentCompanyId,
            }),
          );
          // Don't return early, just skip this filter
          // return { purchases: [], pagination: { total: 0, page, limit, pages: 0, hasNextPage: false, hasPreviousPage: false } };
        }
      }

      // 3. Filter by specific Client ID
      if (filters.clientId && filters.clientId.trim() !== '') {
        try {
          const specificClientId = new Types.ObjectId(filters.clientId);
          // Combine with or overwrite existing client filters
          if (
            filterQuery.client_id &&
            filterQuery.client_id.$in &&
            Array.isArray(filterQuery.client_id.$in)
          ) {
            // Check if the specific client is already within the filtered list
            const currentFilteredIds: Types.ObjectId[] =
              filterQuery.client_id.$in
                .map((id) =>
                  id instanceof Types.ObjectId
                    ? id
                    : Types.ObjectId.isValid(id)
                      ? new Types.ObjectId(id)
                      : null,
                )
                .filter((id) => id !== null);

            if (currentFilteredIds.some((id) => id.equals(specificClientId))) {
              // If included, narrow down to only this client
              filterQuery.client_id = specificClientId;
            } else {
              // The specific client is not part of the previous filter results, impossible condition
              filterQuery.client_id = { $in: [] };
            }
          } else {
            // No other client filters, just use this one
            filterQuery.client_id = specificClientId;
          }
        } catch (error: any) {
          this.loggerService.error(
            JSON.stringify({
              message:
                'loadAllOrdersWithAttributes: Invalid client ID, skipping filter',
              error: error.message,
              clientId: filters.clientId,
            }),
          );
          // Don't return early, just skip this filter
          // return { purchases: [], pagination: { total: 0, page, limit, pages: 0, hasNextPage: false, hasPreviousPage: false } };
        }
      }

      // 4. Filter by Product ID
      if (filters.productId && filters.productId.trim() !== '') {
        try {
          filterQuery.products = new Types.ObjectId(filters.productId); // Assumes products is array of ObjectIds
        } catch (error: any) {
          this.loggerService.error(
            JSON.stringify({
              message:
                'loadAllOrdersWithAttributes: Invalid product ID, skipping filter',
              error: error.message,
              productId: filters.productId,
            }),
          );
          // Don't return early, just skip this filter
          // return { purchases: [], pagination: { total: 0, page, limit, pages: 0, hasNextPage: false, hasPreviousPage: false } };
        }
      }

      // 5. Filter by Status
      if (filters.status) {
        filterQuery.status = filters.status;
      }
      // --- End Build Filter Query ---

      this.loggerService.log(
        JSON.stringify({
          message: 'Constructed Filter Query',
          data: filterQuery,
        }),
      );

      if (filterQuery.client_id?.$in) {
        filterQuery.client_id.$in = filterQuery.client_id?.$in.map((id) =>
          String(id),
        );
      } else if (filterQuery.client_id) {
        filterQuery.client_id = String(filterQuery.client_id);
      }
      // Fetch Total Count with Filters
      const totalOrders = await this.orderModel.countDocuments(filterQuery);

      // If no orders match, return early
      if (totalOrders === 0) {
        this.loggerService.log(
          JSON.stringify({
            message: 'No orders found',
            data: filterQuery,
            totalOrders,
          }),
        );
        return {
          purchases: [],
          pagination: {
            total: 0,
            page,
            limit,
            pages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        }; // Removed company arrays
      }

      this.loggerService.log(
        JSON.stringify({ message: 'Total Orders', data: totalOrders }),
      );
      // Fetch Paginated Orders with Filters and Population

      const orders = await this.orderModel
        .find(filterQuery)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate([
          { path: 'licenses', model: License.name },
          { path: 'customizations', model: Customization.name },
          { path: 'additional_services', model: AdditionalService.name },
          { path: 'client_id', select: 'name parent_company_id' }, // Only select needed fields, no population
          { path: 'products', model: Product.name },
        ]);

      this.loggerService.log(
        JSON.stringify({
          message: 'loadAllOrdersWithAttributes: Orders fetched successfully',
          count: orders.length,
          page,
          limit,
        }),
      );

      // --- Process Orders (Removed Company Aggregation) ---
      const processedOrders = await Promise.all(
        orders.map(async (order: any) => {
          const orderObj: any = order.toObject(); // Start with plain object as any
          orderObj.purchase_type = PURCHASE_TYPE.ORDER;

          // Process Client and Parent Company Info (only for adding parent to client in response)
          if (order.client_id && orderObj.client_id) {
            // Check both original and object
            // Safely handle parent company information
            try {
              const parentCompanyId = order.client_id
                ?.parent_company_id as unknown as ClientDocument & {
                _id: Types.ObjectId;
              };

              if (parentCompanyId) {
                const parentCompany = await this.clientModel
                  .findById(parentCompanyId)
                  .select('name')
                  .lean();
                if (parentCompany) {
                  orderObj.client_id.parent_company = parentCompany;
                }
              }
            } catch (error) {
              // If there's an error processing parent company, just continue without it
              this.loggerService.warn(
                JSON.stringify({
                  message:
                    'loadAllOrdersWithAttributes: Error processing parent company',
                  orderId: order._id?.toString(),
                  clientId: order.client_id._id?.toString(),
                  error:
                    error instanceof Error ? error.message : 'Unknown error',
                }),
              );
            }
          }

          // Process purchase order document URL
          orderObj.purchase_order_document = order.purchase_order_document
            ? this.storageService.get(order.purchase_order_document)
            : null;

          // Process agreement document URLs
          if (order.agreements && order.agreements.length) {
            orderObj.agreements = order.agreements.map((agreement) => {
              const agreementObj: any = { ...agreement };
              agreementObj.document = agreement?.document // Optional chaining
                ? this.storageService.get(agreement.document)
                : null;
              return agreementObj;
            });
          } else {
            orderObj.agreements = [];
          }

          // Process licenses
          if (order.licenses && order.licenses.length) {
            orderObj.licenses = order.licenses
              .map((license: any) => {
                if (!license) return null; // Skip if license is null/undefined
                const licenseObj: any = license;
                licenseObj.status = order.status;
                licenseObj.purchase_order_document =
                  license.purchase_order_document
                    ? this.storageService.get(license.purchase_order_document)
                    : null;
                licenseObj.invoice_document = license.invoice_document
                  ? this.storageService.get(license.invoice_document)
                  : null;
                return licenseObj;
              })
              .filter((l) => l !== null); // Filter out any null results
          } else {
            orderObj.licenses = [];
          }

          // Process customizations
          if (order.customizations && order.customizations.length) {
            orderObj.customizations = order.customizations
              .map((customization) => {
                if (!customization) return null; // Skip if customization is null/undefined
                const customizationObj: any = customization.toObject();
                customizationObj.status = order.status;
                customizationObj.purchase_order_document =
                  customization.purchase_order_document
                    ? this.storageService.get(
                        customization.purchase_order_document,
                      )
                    : null;
                return customizationObj;
              })
              .filter((c) => c !== null); // Filter out any null results
          } else {
            orderObj.customizations = [];
          }

          // Process additional services
          if (order.additional_services && order.additional_services.length) {
            orderObj.additional_services = order.additional_services
              .map((service) => {
                if (!service) return null; // Skip if service is null/undefined
                const serviceObj: any = service.toObject();
                serviceObj.status = order.status;
                serviceObj.purchase_order_document =
                  service.purchase_order_document
                    ? this.storageService.get(service.purchase_order_document)
                    : null;
                serviceObj.service_document = service.service_document
                  ? this.storageService.get(service.service_document)
                  : null;
                return serviceObj;
              })
              .filter((s) => s !== null); // Filter out any null results
          } else {
            orderObj.additional_services = [];
          }

          return orderObj;
        }),
      );
      // --- End Process Orders ---

      this.loggerService.log(
        JSON.stringify({
          message: 'loadAllOrdersWithAttributes: Completed processing orders',
          data: { processedCount: processedOrders.length }, // Removed company counts
        }),
      );

      return {
        purchases: processedOrders,
        pagination: {
          total: totalOrders,
          page,
          limit,
          pages: Math.ceil(totalOrders / limit),
          hasNextPage: page < Math.ceil(totalOrders / limit),
          hasPreviousPage: page > 1,
        },
        // Removed clientCompanies and parentCompanies from return object
      };
    } catch (error: any) {
      console.log(error);
      this.loggerService.error(
        JSON.stringify({
          message: 'loadAllOrdersWithAttributes: Error fetching orders',
          error: error.message,
          stack: error.stack,
        }),
      );

      // Return empty result set on error
      return {
        purchases: [],
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

  // create handler for getting amc by order id
  async getAmcByOrderId(orderId: string) {
    if (!orderId) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getAmcByOrderId: Order id is required',
        }),
      );
      throw new HttpException('Order id is required', HttpStatus.BAD_REQUEST);
    }

    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getAmcByOrderId: Fetching AMC',
          orderId,
        }),
      );

      const amc = await this.amcModel.findOne({ order_id: orderId }).populate([
        {
          path: 'client_id',
          select: 'name',
        },
        {
          path: 'products',
        },
      ]);

      if (!amc) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getAmcByOrderId: AMC not found',
            orderId,
          }),
        );
        throw new HttpException('AMC not found', HttpStatus.NOT_FOUND);
      }

      const amcObject = amc.toObject();
      amcObject['client'] = amcObject.client_id;
      delete amcObject.client_id;

      amcObject.payments.forEach((payment) => {
        if (payment.purchase_order_document) {
          payment.purchase_order_document = this.storageService.get(
            payment.purchase_order_document,
          );
        }
        if (payment.invoice_document) {
          payment.invoice_document = this.storageService.get(
            payment.invoice_document,
          );
        }
      });

      this.loggerService.log(
        JSON.stringify({
          message: 'getAmcByOrderId: AMC found successfully',
          orderId,
        }),
      );

      return amcObject;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getAmcByOrderId: Error fetching AMC',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateAmcPaymentById(
    id: string,
    paymentId: string,
    body: UpdateAMCPaymentDto,
  ) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'updateAmcPaymentById: Updating AMC payment',
          id,
          paymentId,
          body,
        }),
      );

      const amc = await this.amcModel.findById(id);

      if (!amc) {
        this.loggerService.error(
          JSON.stringify({
            message: 'updateAmcPaymentById: AMC not found',
            id,
          }),
        );
        throw new HttpException('AMC not found', HttpStatus.NOT_FOUND);
      }

      // Find the payment index in the payments array
      const paymentIndex = amc.payments.findIndex(
        (payment) => payment._id.toString() === paymentId.toString(),
      );

      if (paymentIndex === -1) {
        this.loggerService.error(
          JSON.stringify({
            message: 'updateAmcPaymentById: AMC payment not found',
            id,
            paymentId,
          }),
        );
        throw new HttpException('AMC payment not found', HttpStatus.NOT_FOUND);
      }

      amc.payments[paymentIndex] = {
        ...amc.payments[paymentIndex],
        ...body,
      };

      await amc.save();

      return amc;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'updateAmcPaymentById: Error updating AMC payment',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteAmcPaymentById(amcId: string, paymentId: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'deleteAmcPaymentById: Deleting AMC payment',
          data: { amcId, paymentId },
        }),
      );

      const amc = await this.amcModel.findById(amcId);

      if (!amc) {
        this.loggerService.error(
          JSON.stringify({
            message: 'deleteAmcPaymentById: AMC not found',
            data: { amcId },
          }),
        );
        throw new HttpException('AMC not found', HttpStatus.NOT_FOUND);
      }

      // Check if payment exists
      const paymentExists = amc.payments.some(
        (payment) => payment._id.toString() === paymentId,
      );

      if (!paymentExists) {
        this.loggerService.error(
          JSON.stringify({
            message: 'deleteAmcPaymentById: Payment not found in AMC',
            data: { amcId, paymentId },
          }),
        );
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      // Use the $pull operator to remove the payment with the matching _id
      const updatedAmc = await this.amcModel.findByIdAndUpdate(
        amcId,
        {
          $pull: {
            payments: { _id: paymentId },
          },
        },
        { new: true }, // Return the updated document
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'deleteAmcPaymentById: Payment deleted successfully',
          data: { amcId, paymentId },
        }),
      );

      return updatedAmc;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'deleteAmcPaymentById: Error deleting AMC payment',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getLicenseById(id: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getLicenseById: Fetching license',
          id,
        }),
      );

      const license = await this.licenseModel.findById(id);

      const licenseObj = license.toObject();
      if (licenseObj.purchase_order_document) {
        licenseObj.purchase_order_document = this.storageService.get(
          licenseObj.purchase_order_document,
        );
      }

      if (licenseObj.invoice_document) {
        licenseObj.invoice_document = this.storageService.get(
          licenseObj.invoice_document,
        );
      }

      if (!license) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getLicenseById: License not found',
            id,
          }),
        );
        throw new HttpException('License not found', HttpStatus.NOT_FOUND);
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'getLicenseById: License found successfully',
          id,
        }),
      );

      return licenseObj;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getLicenseById: Error fetching license',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAdditionalServiceById(id: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getAdditionalServiceById: Fetching additional service',
          id,
        }),
      );

      const additionalService = await this.additionalServiceModel.findById(id);

      const additionalServiceObj = additionalService.toObject();
      if (additionalServiceObj.purchase_order_document) {
        additionalServiceObj.purchase_order_document = this.storageService.get(
          additionalServiceObj.purchase_order_document,
        );
      } else if (additionalServiceObj.service_document) {
        additionalServiceObj.service_document = this.storageService.get(
          additionalServiceObj.service_document,
        );
      }

      if (!additionalService) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getAdditionalServiceById: Additional service not found',
            id,
          }),
        );
      }

      return additionalServiceObj;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message:
            'getAdditionalServiceById: Error fetching additional service',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCustomizationById(id: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getCustomizationById: Fetching customization',
          id,
        }),
      );

      const customization = await this.customizationModel.findById(id);

      if (!customization) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getCustomizationById: Customization not found',
            id,
          }),
        );
        throw new HttpException(
          'Customization not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const customizationObj = customization.toObject();
      if (customizationObj.purchase_order_document) {
        customizationObj.purchase_order_document = this.storageService.get(
          customizationObj.purchase_order_document,
        );
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'getCustomizationById: Customization found successfully',
          id,
        }),
      );

      return customizationObj;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getCustomizationById: Error fetching customization',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateAdditionalServiceById(
    id: string,
    body: CreateAdditionalServiceDto,
  ) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'updateAdditionalService: Updating additional service',
          id,
          body,
        }),
      );

      const additionalService =
        await this.additionalServiceModel.findByIdAndUpdate(id, body, {
          new: true,
        });

      this.loggerService.log(
        JSON.stringify({
          message:
            'updateAdditionalService: Additional service updated successfully',
          id,
        }),
      );

      return additionalService;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'updateAdditionalService: Error updating additional service',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateAMCById(id: string, body: UpdateAMCDto) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'updateAMCById: Updating AMC',
          id,
          body,
        }),
      );
      const amc = await this.amcModel.findByIdAndUpdate(id, body, {
        new: true,
      });

      this.loggerService.log(
        JSON.stringify({
          message: 'updateAMCById: AMC updated successfully',
          id,
        }),
      );
      return amc;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'updateAMCById: Error updating AMC',
          error: error.message,
        }),
      );
    }
  }

  async updateCustomizationById(id: string, body: CreateCustomizationDto) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'updateCustomization: Updating customization',
          id,
          body,
        }),
      );

      const customization = await this.customizationModel.findByIdAndUpdate(
        id,
        body,
        { new: true },
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'updateCustomization: Customization updated successfully',
          id,
        }),
      );

      return customization;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'updateCustomization: Error updating customization',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateLicenseById(id: string, body: CreateLicenseDto) {
    try {
      const { cost_per_license, product_id, total_license } = body;
      this.loggerService.log(
        JSON.stringify({
          message: 'updateLicense: Updating license',
          id,
          body,
        }),
      );

      const license = await this.licenseModel.findByIdAndUpdate(
        id,
        {
          $set: {
            'rate.amount': cost_per_license,
            'rate.percentage': 0,
            total_license,
            product_id,
            purchase_date: body.purchase_date,
            purchase_order_document: body.purchase_order_document,
            invoice_document: body.invoice_document,
          },
        },
        {
          new: true,
        },
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'updateLicense: License updated successfully',
          id,
        }),
      );

      return license;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'updateLicense: Error updating license',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async loadAllAMC(
    page: number,
    limit: number,
    filters: AMC_FILTER[],
    options: {
      startDate?: Date | string;
      endDate?: Date | string;
      clientId?: string;
      productId?: string;
    } = {},
  ) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'loadAllAMC: Fetching all AMC',
          filters,
          options,
        }),
      );

      // Fetch active orders first
      const activeOrders = await this.orderModel
        .find({ status: ORDER_STATUS_ENUM.ACTIVE })
        .distinct('_id');

      this.loggerService.log(
        JSON.stringify({
          message: 'loadAllAMC: Active orders found',
          count: activeOrders.length,
        }),
      );

      // Build the query for AMC filtering
      const amcQuery: any = {
        payments: { $exists: true },
        order_id: { $in: activeOrders },
      };

      // Add client_id filter if provided
      if (options.clientId) {
        try {
          amcQuery.client_id = new Types.ObjectId(options.clientId);
          this.loggerService.log(
            JSON.stringify({
              message: 'loadAllAMC: Applied client filter',
              clientId: options.clientId,
            }),
          );
        } catch (error) {
          this.loggerService.error(
            JSON.stringify({
              message: 'loadAllAMC: Invalid client ID format',
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }

      // Add product_id filter if provided
      if (options.productId) {
        try {
          amcQuery.products = new Types.ObjectId(options.productId);
          this.loggerService.log(
            JSON.stringify({
              message: 'loadAllAMC: Applied product filter',
              productId: options.productId,
            }),
          );
        } catch (error) {
          this.loggerService.error(
            JSON.stringify({
              message: 'loadAllAMC: Invalid product ID format',
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }

      // Fetch all AMCs with basic filtering
      const allAmcs = await this.amcModel
        .find(amcQuery)
        .sort({ _id: -1 })
        .populate([
          {
            path: 'client_id',
            model: Client.name,
          },
          {
            path: 'order_id',
            model: Order.name,
          },
          {
            path: 'products',
            model: Product.name,
          },
        ]);

      this.loggerService.log(
        JSON.stringify({
          message:
            'loadAllAMC: Total AMCs fetched before filtering (only active orders)',
          count: allAmcs.length,
        }),
      );

      // Process and filter AMCs in memory
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today

      // Convert date strings to Date objects if provided
      const startDate =
        options.startDate && options.startDate !== 'undefined'
          ? new Date(options.startDate)
          : null;

      const endDate =
        options.endDate && options.endDate !== 'undefined'
          ? new Date(options.endDate)
          : null;

      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(23, 59, 59, 999);

      // Create a map to track which AMCs match each filter type
      const matchingAmcIds = new Map<string, Set<AMC_FILTER>>();

      // Process each AMC
      for (const amc of allAmcs) {
        // Skip AMCs with invalid payment data
        if (!Array.isArray(amc.payments) || amc.payments.length === 0) {
          continue;
        }

        const amcId = amc._id.toString();

        // For each filter type, check if this AMC has matching payments
        for (const filterType of filters) {
          let matches = false;

          switch (filterType) {
            case AMC_FILTER.PAID:
              // Check if ANY payment is PAID and matches date range
              matches = amc.payments.some((payment) => {
                const paymentDate = new Date(payment.from_date);
                const dateInRange =
                  (!startDate || paymentDate >= startDate) &&
                  (!endDate || paymentDate <= endDate);

                return (
                  payment.status === PAYMENT_STATUS_ENUM.PAID &&
                  ((!startDate && !endDate) || dateInRange)
                );
              });
              break;

            case AMC_FILTER.PENDING:
              // Check if ANY payment is PENDING and matches date range
              matches = amc.payments.some((payment) => {
                const paymentDate = new Date(payment.from_date);
                const dateInRange =
                  (!startDate || paymentDate >= startDate) &&
                  (!endDate || paymentDate <= endDate);

                return (
                  payment.status === PAYMENT_STATUS_ENUM.PENDING &&
                  ((!startDate && !endDate) || dateInRange)
                );
              });
              break;

            case AMC_FILTER.PROFORMA:
              // Check if ANY payment is PROFORMA and matches date range
              matches = amc.payments.some((payment) => {
                const paymentDate = new Date(payment.from_date);
                const dateInRange =
                  (!startDate || paymentDate >= startDate) &&
                  (!endDate || paymentDate <= endDate);

                return (
                  payment.status === PAYMENT_STATUS_ENUM.proforma &&
                  ((!startDate && !endDate) || dateInRange)
                );
              });
              break;

            case AMC_FILTER.INVOICE:
              // Check if ANY payment is INVOICE and matches date range
              matches = amc.payments.some((payment) => {
                const paymentDate = new Date(payment.from_date);
                const dateInRange =
                  (!startDate || paymentDate >= startDate) &&
                  (!endDate || paymentDate <= endDate);

                return (
                  payment.status === PAYMENT_STATUS_ENUM.INVOICE &&
                  ((!startDate && !endDate) || dateInRange)
                );
              });
              break;
          }

          // If this AMC matches the current filter, add it to the tracking map
          if (matches) {
            if (!matchingAmcIds.has(amcId)) {
              matchingAmcIds.set(amcId, new Set<AMC_FILTER>());
            }
            matchingAmcIds.get(amcId).add(filterType);
          }
        }
      }

      // Log filter counts
      const filterCounts = {} as Record<string, number>;
      const matchedAmcs = new Set<string>();
      const totalAmountByFilter = {} as Record<string, number>;

      for (const [amcId, matchedFilters] of matchingAmcIds.entries()) {
        matchedAmcs.add(amcId);
        // Find the corresponding AMC object
        const amc = allAmcs.find((a) => a._id.toString() === amcId);
        if (!amc) continue;

        for (const filter of matchedFilters) {
          // Update filter counts
          filterCounts[filter] = (filterCounts[filter] || 0) + 1;

          // Calculate total amount for this filter type
          // For each filter, we only consider payments that match the filter type
          let amcAmount = 0;

          switch (filter) {
            case AMC_FILTER.PAID:
              // Sum up amounts of PAID payments within date range
              amcAmount = amc.payments
                .filter((payment) => {
                  const paymentDate = new Date(payment.from_date);
                  const dateInRange =
                    (!startDate || paymentDate >= startDate) &&
                    (!endDate || paymentDate <= endDate);
                  return (
                    payment.status === PAYMENT_STATUS_ENUM.PAID &&
                    ((!startDate && !endDate) || dateInRange)
                  );
                })
                .reduce(
                  (sum, payment) => sum + (payment.amc_rate_amount || 0),
                  0,
                );
              break;

            case AMC_FILTER.PENDING:
              // Sum up amounts of PENDING payments within date range
              amcAmount = amc.payments
                .filter((payment) => {
                  const paymentDate = new Date(payment.from_date);
                  const dateInRange =
                    (!startDate || paymentDate >= startDate) &&
                    (!endDate || paymentDate <= endDate);
                  return (
                    payment.status === PAYMENT_STATUS_ENUM.PENDING &&
                    ((!startDate && !endDate) || dateInRange)
                  );
                })
                .reduce(
                  (sum, payment) => sum + (payment.amc_rate_amount || 0),
                  0,
                );
              break;

            case AMC_FILTER.PROFORMA:
              // Sum up amounts of PROFORMA payments within date range
              amcAmount = amc.payments
                .filter((payment) => {
                  const paymentDate = new Date(payment.from_date);
                  const dateInRange =
                    (!startDate || paymentDate >= startDate) &&
                    (!endDate || paymentDate <= endDate);
                  return (
                    payment.status === PAYMENT_STATUS_ENUM.proforma &&
                    ((!startDate && !endDate) || dateInRange)
                  );
                })
                .reduce(
                  (sum, payment) => sum + (payment.amc_rate_amount || 0),
                  0,
                );
              break;

            case AMC_FILTER.INVOICE:
              // Sum up amounts of INVOICE payments within date range
              amcAmount = amc.payments
                .filter((payment) => {
                  const paymentDate = new Date(payment.from_date);
                  const dateInRange =
                    (!startDate || paymentDate >= startDate) &&
                    (!endDate || paymentDate <= endDate);
                  return (
                    payment.status === PAYMENT_STATUS_ENUM.INVOICE &&
                    ((!startDate && !endDate) || dateInRange)
                  );
                })
                .reduce(
                  (sum, payment) => sum + (payment.amc_rate_amount || 0),
                  0,
                );
              break;
          }

          // Add to total for this filter type
          totalAmountByFilter[filter] =
            (totalAmountByFilter[filter] || 0) + amcAmount;
        }
      }

      // Calculate overall total amount across all filters
      const totalAmount = Object.values(totalAmountByFilter).reduce(
        (sum, amount) => sum + amount,
        0,
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'loadAllAMC: Filter results breakdown',
          data: {
            filterCounts,
            totalUniqueMatches: matchedAmcs.size,
            totalAmountByFilter,
            totalAmount,
          },
        }),
      );

      // Filter AMCs to include only those that matched at least one filter
      const filteredAmcs = allAmcs.filter((amc) =>
        matchingAmcIds.has(amc._id.toString()),
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'loadAllAMC: AMCs after filtering',
          count: filteredAmcs.length,
          filters,
          dateRange: {
            startDate: startDate ? startDate.toISOString() : null,
            endDate: endDate ? endDate.toISOString() : null,
          },
        }),
      );

      // Apply pagination in memory
      const totalCount = filteredAmcs.length;
      const skip = (page - 1) * limit;
      const paginatedAmcs = filteredAmcs.slice(skip, skip + limit);

      // Process the AMC objects for response
      const amcsList = [];
      for (const amc of paginatedAmcs) {
        try {
          const amcObj = amc.toObject();

          amcObj.payments.forEach((payment) => {
            if (payment.purchase_order_document) {
              payment.purchase_order_document = this.storageService.get(
                payment.purchase_order_document,
              );
            }
            if (payment.invoice_document) {
              payment.invoice_document = this.storageService.get(
                payment.invoice_document,
              );
            }
          });

          amcObj['client'] = amcObj.client_id;
          delete amcObj.client_id;

          amcObj['order'] = amcObj.order_id;
          delete amcObj.order_id;

          const lastPayment = amcObj.payments[amcObj.payments.length - 1];
          amcObj['last_payment'] = lastPayment;

          amcsList.push(amcObj);
        } catch (error: any) {
          this.loggerService.error(
            JSON.stringify({
              message: 'loadAllAMC: Error processing AMC object',
              amcId: amc._id,
              error: error.message,
            }),
          );
          continue;
        }
      }

      // Prepare response data
      const responseData = {
        data: {
          pagination: {
            total: totalCount,
            page,
            limit,
            pages: Math.ceil(totalCount / limit),
          },
          total_amount: {
            ...totalAmountByFilter,
            total: totalAmount,
          },
          data: amcsList,
        },
      };

      return responseData;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'loadAllAMC: Error fetching AMC',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getNextDate(fromDate: Date, totalMonths: number): Date {
    // Create a new date object based on fromDate
    const nextDate = new Date(fromDate);

    // Add the totalMonths to the month
    nextDate.setMonth(nextDate.getMonth() + totalMonths);

    // Return the calculated date
    return nextDate;
  }

  // Schedule handler for updating AMC payments
  async updateAMCPayments() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'updateAMCPayments: Starting AMC payments update process',
          timestamp: new Date().toISOString(),
        }),
      );

      // Find AMCs with populated relationships
      const amcs = await this.amcModel
        .find({}) // Removed payments filter to get all AMCs
        .populate({
          path: 'order_id',
          model: Order.name,
          populate: [
            {
              path: 'customizations',
              model: Customization.name,
            },
            {
              path: 'licenses',
              model: License.name,
            },
            {
              path: 'client_id',
              model: Client.name,
              select: 'amc_frequency_in_months',
            },
          ],
        });

      this.loggerService.log(
        JSON.stringify({
          message: 'updateAMCPayments: Found AMCs to process',
          totalAMCs: amcs.length,
        }),
      );

      const today = new Date();
      let updatedPaymentsCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let newPaymentsAdded = 0;

      const updates = amcs.map(async (amc) => {
        try {
          const order = amc.order_id as any;
          if (!order || !order.amc_start_date) {
            skippedCount++;
            this.loggerService.log(
              JSON.stringify({
                message: 'updateAMCPayments: Skipping AMC without start date',
                amcId: amc._id,
              }),
            );
            return;
          }

          // Skip if payments array is empty
          if (!amc.payments || amc.payments.length === 0) {
            this.loggerService.log(
              JSON.stringify({
                message:
                  'updateAMCPayments: Skipping AMC with empty payments array',
                amcId: amc._id,
              }),
            );
            skippedCount++;
            return;
          }

          const amc_frequency_in_months =
            order.client_id?.amc_frequency_in_months || 12;
          const lastPayment = amc.payments[amc.payments.length - 1];

          this.loggerService.log(
            JSON.stringify({
              message: 'updateAMCPayments: Processing AMC',
              amcId: amc._id,
              lastPaymentDate: lastPayment.to_date,
              frequency: amc_frequency_in_months,
            }),
          );

          // Check for last agreement in the order
          const agreements = order.agreements || [];
          const lastAgreement =
            agreements.length > 0 ? agreements[agreements.length - 1] : null;

          // Check if we need to add a new payment based on agreement
          if (lastAgreement) {
            this.loggerService.log(
              JSON.stringify({
                message: 'updateAMCPayments: Found last agreement',
                amcId: amc._id,
                agreementStartDate: lastAgreement.start,
                agreementEndDate: lastAgreement.end,
              }),
            );

            // Get the last year from the agreement end date
            const agreementEndYear = new Date(lastAgreement.end).getFullYear();
            const lastPaymentYear = new Date(lastPayment.to_date).getFullYear();

            // Check if the last payment year covers the agreement end year
            if (lastPaymentYear < agreementEndYear) {
              // We need to add payments up to the agreement end date
              let fromDate = new Date(lastPayment.to_date);
              const agreementEndDate = new Date(lastAgreement.end);

              this.loggerService.log(
                JSON.stringify({
                  message:
                    'updateAMCPayments: Adding payments to cover agreement period',
                  amcId: amc._id,
                  lastPaymentToDate: fromDate,
                  agreementEndDate: agreementEndDate,
                }),
              );

              // Calculate total cost including customizations and licenses
              let totalCost = order.base_cost;

              // Add customization costs
              const customizations = order.customizations || [];
              for (const customization of customizations) {
                totalCost += customization.cost || 0;
              }

              // Add license costs
              const licenses = order.licenses || [];
              for (const license of licenses) {
                const licenseCost =
                  (license.rate?.amount || 0) * (license.total_license || 0);
                totalCost += licenseCost;
              }

              // Calculate AMC amount based on total cost
              const amcAmount = (totalCost / 100) * order.amc_rate.percentage;

              // Create new payment to cover the agreement period
              while (fromDate < agreementEndDate) {
                const toDate = this.getNextDate(
                  new Date(fromDate),
                  amc_frequency_in_months,
                );

                const newPayment = {
                  from_date: fromDate,
                  to_date: toDate,
                  status: PAYMENT_STATUS_ENUM.PENDING,
                  amc_frequency: amc_frequency_in_months,
                  total_cost: totalCost,
                  amc_rate_applied: order.amc_rate.percentage,
                  amc_rate_amount: amcAmount,
                };

                // Update AMC with new payment and latest amounts
                await this.amcModel.findByIdAndUpdate(amc._id, {
                  $push: { payments: newPayment },
                  amount: amcAmount,
                  total_cost: totalCost,
                });

                this.loggerService.log(
                  JSON.stringify({
                    message:
                      'updateAMCPayments: Added new payment based on agreement',
                    amcId: amc._id,
                    newPayment,
                  }),
                );

                fromDate = toDate;
                newPaymentsAdded++;
                updatedPaymentsCount++;
              }
            } else {
              // Check if we need to add a new payment based on current date
              if (today > new Date(lastPayment.to_date)) {
                this.createNewPayment(
                  order,
                  amc,
                  lastPayment,
                  amc_frequency_in_months,
                );
                updatedPaymentsCount++;
                newPaymentsAdded++;
              } else {
                skippedCount++;
                this.loggerService.log(
                  JSON.stringify({
                    message: 'updateAMCPayments: Skipped AMC - payment not due',
                    amcId: amc._id,
                  }),
                );
              }
            }
          } else {
            // No agreement exists, use original logic
            if (today > new Date(lastPayment.to_date)) {
              this.createNewPayment(
                order,
                amc,
                lastPayment,
                amc_frequency_in_months,
              );
              updatedPaymentsCount++;
              newPaymentsAdded++;
            } else {
              skippedCount++;
              this.loggerService.log(
                JSON.stringify({
                  message: 'updateAMCPayments: Skipped AMC - payment not due',
                  amcId: amc._id,
                }),
              );
            }
          }
        } catch (error: any) {
          errorCount++;
          this.loggerService.error(
            JSON.stringify({
              message: 'updateAMCPayments: Error processing individual AMC',
              amcId: amc._id,
              error: error.message,
              stack: error.stack,
            }),
          );
        }
      });

      await Promise.all(updates);

      this.loggerService.log(
        JSON.stringify({
          message: 'updateAMCPayments: Completed processing',
          summary: {
            totalProcessed: amcs.length,
            updated: updatedPaymentsCount,
            skipped: skippedCount,
            errors: errorCount,
            newPaymentsAdded,
            completionTime: new Date().toISOString(),
          },
        }),
      );

      return {
        processed: amcs.length,
        updated: updatedPaymentsCount,
        skipped: skippedCount,
        errors: errorCount,
        newPaymentsAdded,
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message:
            'updateAMCPayments: Critical error in payment update process',
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        }),
      );
      throw error;
    }
  }

  // Helper method to create a new payment
  private async createNewPayment(
    order: any,
    amc: any,
    lastPayment: any,
    amc_frequency_in_months: number,
  ) {
    // Calculate total cost including customizations and licenses
    let totalCost = order.base_cost;

    // Add customization costs
    const customizations = order.customizations || [];
    for (const customization of customizations) {
      totalCost += customization.cost || 0;
    }

    // Add license costs
    const licenses = order.licenses || [];
    for (const license of licenses) {
      const licenseCost =
        (license.rate?.amount || 0) * (license.total_license || 0);
      totalCost += licenseCost;
    }

    // Calculate AMC amount based on total cost
    const amcAmount = (totalCost / 100) * order.amc_rate.percentage;

    const newPayment = {
      from_date: new Date(lastPayment.to_date),
      to_date: this.getNextDate(
        new Date(lastPayment.to_date),
        amc_frequency_in_months,
      ),
      status: PAYMENT_STATUS_ENUM.PENDING,
      amc_frequency: amc_frequency_in_months,
      total_cost: totalCost,
      amc_rate_applied: order.amc_rate.percentage,
      amc_rate_amount: amcAmount,
    };

    // Update AMC with new payment and latest amounts
    await this.amcModel.findByIdAndUpdate(amc._id, {
      $push: { payments: newPayment },
      amount: amcAmount,
      total_cost: totalCost,
    });

    this.loggerService.log(
      JSON.stringify({
        message: 'updateAMCPayments: Added new payment',
        amcId: amc._id,
        newPayment,
      }),
    );
  }

  async getAllPendingPayments(
    page: number = 1,
    limit: number = 20,
    filters: {
      startDate?: string;
      endDate?: string;
      clientId?: string;
      clientName?: string;
      type?: 'order' | 'amc' | 'all';
    } = {},
  ) {
    try {
      const { startDate, endDate, clientId, clientName, type } = filters;

      this.loggerService.log(
        JSON.stringify({
          message: 'getAllPendingPayments: Starting to fetch pending payments',
          data: { page, limit, ...filters },
        }),
      );

      // Helper for empty pagination result
      const emptyPaginationResult = (p: number, l: number) => ({
        pending_payments: [],
        pagination: {
          total: 0,
          currentPage: p,
          totalPages: 0,
          limit: l,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      // 1. Date parsing and validation
      let parsedStartDate: Date | undefined = undefined;
      let parsedEndDate: Date | undefined = undefined;

      if (startDate && startDate !== 'undefined') {
        parsedStartDate = new Date(startDate);
        if (isNaN(parsedStartDate.getTime())) {
          this.loggerService.warn(
            JSON.stringify({
              message:
                'getAllPendingPayments: Invalid start date format, ignoring.',
              startDate,
            }),
          );
          parsedStartDate = undefined;
        }
      }
      if (endDate && endDate !== 'undefined') {
        parsedEndDate = new Date(endDate);
        if (isNaN(parsedEndDate.getTime())) {
          this.loggerService.warn(
            JSON.stringify({
              message:
                'getAllPendingPayments: Invalid end date format, ignoring.',
              endDate,
            }),
          );
          parsedEndDate = undefined;
        }
      }
      if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
        this.loggerService.warn(
          JSON.stringify({
            message:
              'getAllPendingPayments: Start date is after end date, date filter will be ignored.',
            parsedStartDate,
            parsedEndDate,
          }),
        );
        parsedStartDate = undefined;
        parsedEndDate = undefined;
      }

      // 2. Client filter resolution
      let resolvedClientObjectIds: Types.ObjectId[] | null = null;
      if (clientName && clientName.trim() !== '') {
        const clientsByName = await this.clientModel
          .find({ name: { $regex: clientName, $options: 'i' } })
          .select('_id')
          .lean<{ _id: Types.ObjectId }[]>();
        resolvedClientObjectIds = clientsByName.map((c) => c._id);
        if (resolvedClientObjectIds.length === 0) {
          this.loggerService.log(
            JSON.stringify({
              message:
                'getAllPendingPayments: No client found by name, returning empty.',
              clientName,
            }),
          );
          return emptyPaginationResult(page, limit);
        }
      }

      let finalClientFilterCriteria: any = {}; // For direct use in model queries (AMC)
      let clientFilterForActiveOrders: any = {}; // For filtering orders to get activeOrderIds

      if (clientId && Types.ObjectId.isValid(clientId)) {
        const specificClientId = new Types.ObjectId(clientId);
        if (resolvedClientObjectIds) {
          // clientName was also provided
          if (
            resolvedClientObjectIds.some((id) => id.equals(specificClientId))
          ) {
            finalClientFilterCriteria = { client_id: specificClientId };
            clientFilterForActiveOrders = { client_id: specificClientId };
          } else {
            this.loggerService.log(
              JSON.stringify({
                message:
                  'getAllPendingPayments: Specified clientId not found in clientName search results, returning empty.',
                clientId,
                clientName,
              }),
            );
            return emptyPaginationResult(page, limit);
          }
        } else {
          // Only clientId provided
          finalClientFilterCriteria = { client_id: specificClientId };
          clientFilterForActiveOrders = { client_id: specificClientId };
        }
      } else if (resolvedClientObjectIds) {
        // Only clientName provided and matched
        finalClientFilterCriteria = {
          client_id: { $in: resolvedClientObjectIds },
        };
        clientFilterForActiveOrders = {
          client_id: { $in: resolvedClientObjectIds },
        };
      }

      if (clientFilterForActiveOrders.client_id?.$in) {
        this.loggerService.log(
          JSON.stringify({
            message:
              'getAllPendingPayments: Converting client_id.$in to string',
            clientId,
          }),
        );
        clientFilterForActiveOrders.client_id.$in =
          clientFilterForActiveOrders.client_id.$in.map((id) => String(id));
      } else if (clientFilterForActiveOrders.client_id) {
        this.loggerService.log(
          JSON.stringify({
            message: 'getAllPendingPayments: Converting client_id to string',
            clientId,
          }),
        );
        clientFilterForActiveOrders.client_id = String(
          clientFilterForActiveOrders.client_id,
        );
      }

      // 3. Get active orders, potentially filtered by client
      const activeOrderQuery: any = {
        status: ORDER_STATUS_ENUM.ACTIVE,
        ...clientFilterForActiveOrders,
      };
      const activeOrderIds = await this.orderModel
        .find(activeOrderQuery)
        .distinct('_id');

      this.loggerService.log(
        JSON.stringify({
          message:
            'getAllPendingPayments: Active order IDs for filtering pending items',
          count: activeOrderIds.length,
          activeOrderQueryApplied: activeOrderQuery,
        }),
      );

      if (activeOrderIds.length === 0 && (clientId || clientName)) {
        this.loggerService.log(
          JSON.stringify({
            message:
              'getAllPendingPayments: No active orders found for the given client filters. Returning empty.',
            filters,
          }),
        );
        return emptyPaginationResult(page, limit);
      }

      // 4. Helper to build date filter part for queries
      const buildDateFilter = (
        dateField: string,
        pStartDate?: Date,
        pEndDate?: Date,
      ): any => {
        const filter: any = {};
        if (pStartDate && pEndDate) {
          filter[dateField] = { $gte: pStartDate, $lte: pEndDate };
        } else if (pStartDate) {
          filter[dateField] = { $gte: pStartDate };
        } else if (pEndDate) {
          filter[dateField] = { $lte: pEndDate };
        }
        return Object.keys(filter).length > 0 ? filter : {}; // Return empty object if no dates
      };

      // Number of payment types to consider based on filter
      let TOTAL_PURCHASES_SCENARIOS = 5; // Default for 'all'

      // Determine which types to fetch based on the type filter
      const shouldFetchAMC = type === 'amc' || type === 'all' || !type;
      const shouldFetchOrder = type === 'order' || type === 'all' || !type;
      const shouldFetchOtherTypes = type === 'all' || !type; // licenses, customizations, additional services

      // Update the count of active scenarios based on type filter
      if (type === 'amc') {
        TOTAL_PURCHASES_SCENARIOS = 1; // Only AMC
      } else if (type === 'order') {
        TOTAL_PURCHASES_SCENARIOS = 1; // Only Order
      } else {
        // For 'all' or undefined, keep the original 5 scenarios
        TOTAL_PURCHASES_SCENARIOS = shouldFetchOtherTypes
          ? 5
          : shouldFetchAMC && shouldFetchOrder
            ? 2
            : 1;
      }

      // Calculate adjusted limit for each schema based on active scenarios
      const pendingLimitForEachSchema = Math.max(
        1,
        Math.floor(limit / TOTAL_PURCHASES_SCENARIOS),
      ); // Ensure at least 1

      // 5. Define queries with filters for each model
      const amcDateFilter = buildDateFilter(
        'createdAt',
        parsedStartDate,
        parsedEndDate,
      );
      const amcBaseQuery = {
        order_id: { $in: activeOrderIds },
        'payments.1': { $exists: true },
        'payments.status': PAYMENT_STATUS_ENUM.PENDING,
        ...amcDateFilter,
        ...finalClientFilterCriteria, // Direct client filter for AMCs
      };

      const licenseDateFilter = buildDateFilter(
        'purchase_date',
        parsedStartDate,
        parsedEndDate,
      );
      const licenseBaseQuery = {
        order_id: { $in: activeOrderIds },
        payment_status: PAYMENT_STATUS_ENUM.PENDING,
        ...licenseDateFilter,
      };

      const customizationDateFilter = buildDateFilter(
        'purchased_date',
        parsedStartDate,
        parsedEndDate,
      );
      const customizationBaseQuery = {
        order_id: { $in: activeOrderIds },
        payment_status: PAYMENT_STATUS_ENUM.PENDING,
        ...customizationDateFilter,
      };

      const serviceDateFilter = buildDateFilter(
        'purchased_date',
        parsedStartDate,
        parsedEndDate,
      );
      const serviceBaseQuery = {
        order_id: { $in: activeOrderIds },
        payment_status: PAYMENT_STATUS_ENUM.PENDING,
        ...serviceDateFilter,
      };

      const orderPaymentTermsDateFilter = buildDateFilter(
        'createdAt',
        parsedStartDate,
        parsedEndDate,
      ); // Order's createdAt
      const orderPaymentTermsBaseQuery = {
        _id: { $in: activeOrderIds }, // Already client filtered via activeOrderIds
        'payment_terms.status': PAYMENT_STATUS_ENUM.PENDING,
        ...orderPaymentTermsDateFilter,
      };

      // Short-circuit if activeOrderIds is empty and filters weren't client-specific (already handled above if client specific)
      // This check is to prevent unnecessary DB calls if there are no active orders at all for other reasons.
      if (activeOrderIds.length === 0) {
        this.loggerService.log(
          JSON.stringify({
            message:
              'getAllPendingPayments: No active orders found (globally or after non-client filters led to empty set for sub-items). Returning empty.',
          }),
        );
        return emptyPaginationResult(page, limit);
      }

      // Get total counts with filters - only count what we need based on type filter
      let [
        totalAMCs,
        totalLicenses,
        totalCustomizations,
        totalServices,
        totalOrders,
      ] = [0, 0, 0, 0, 0]; // Initialize with zeros

      // Prepare query promises based on type filter
      const countPromises: Promise<number>[] = [];

      if (shouldFetchAMC) {
        countPromises.push(this.amcModel.countDocuments(amcBaseQuery));
      } else {
        countPromises.push(Promise.resolve(0));
      }

      if (shouldFetchOtherTypes) {
        countPromises.push(this.licenseModel.countDocuments(licenseBaseQuery));
        countPromises.push(
          this.customizationModel.countDocuments(customizationBaseQuery),
        );
        countPromises.push(
          this.additionalServiceModel.countDocuments(serviceBaseQuery),
        );
      } else {
        countPromises.push(Promise.resolve(0));
        countPromises.push(Promise.resolve(0));
        countPromises.push(Promise.resolve(0));
      }

      if (shouldFetchOrder) {
        countPromises.push(
          this.orderModel.countDocuments(orderPaymentTermsBaseQuery),
        );
      } else {
        countPromises.push(Promise.resolve(0));
      }

      [
        totalAMCs,
        totalLicenses,
        totalCustomizations,
        totalServices,
        totalOrders,
      ] = await Promise.all(countPromises);

      this.loggerService.log(
        JSON.stringify({
          message: 'Counts after filters',
          type,
          totalAMCs,
          totalLicenses,
          totalCustomizations,
          totalServices,
          totalOrders,
        }),
      );

      // Fetch items with filters, pagination per schema
      const skipAmount = (page - 1) * pendingLimitForEachSchema;

      // Prepare fetch promises based on type filter
      const fetchPromises: Promise<any>[] = [];

      if (shouldFetchAMC) {
        fetchPromises.push(
          this.amcModel
            .find(amcBaseQuery)
            .populate('client_id', 'name')
            .populate('products', 'short_name')
            .skip(skipAmount)
            .limit(pendingLimitForEachSchema),
        );
      } else {
        fetchPromises.push(Promise.resolve([]));
      }

      if (shouldFetchOtherTypes) {
        fetchPromises.push(
          this.licenseModel
            .find(licenseBaseQuery)
            .populate({
              path: 'order_id',
              populate: { path: 'client_id', select: 'name' },
            })
            .populate({ path: 'product_id', select: 'short_name' })
            .skip(skipAmount)
            .limit(pendingLimitForEachSchema),
        );

        fetchPromises.push(
          this.customizationModel
            .find(customizationBaseQuery)
            .populate({
              path: 'order_id',
              populate: { path: 'client_id', select: 'name' },
            })
            .populate('product_id', 'short_name')
            .skip(skipAmount)
            .limit(pendingLimitForEachSchema),
        );

        fetchPromises.push(
          this.additionalServiceModel
            .find(serviceBaseQuery)
            .populate({
              path: 'order_id',
              populate: { path: 'client_id', select: 'name' },
            })
            .skip(skipAmount)
            .limit(pendingLimitForEachSchema),
        );
      } else {
        fetchPromises.push(Promise.resolve([]));
        fetchPromises.push(Promise.resolve([]));
        fetchPromises.push(Promise.resolve([]));
      }

      if (shouldFetchOrder) {
        fetchPromises.push(
          this.orderModel
            .find(orderPaymentTermsBaseQuery)
            .populate([
              { path: 'client_id', select: 'name' },
              {
                path: 'products',
                select: 'name short_name',
                model: Product.name,
              },
            ])
            .skip(skipAmount)
            .limit(pendingLimitForEachSchema),
        );
      } else {
        fetchPromises.push(Promise.resolve([]));
      }

      const [
        pendingAMCs,
        pendingLicenses,
        pendingCustomizations,
        pendingServices,
        pendingOrders,
      ] = await Promise.all(fetchPromises);

      const pendingPayments: Array<{
        _id: string;
        type:
          | 'amc'
          | 'order'
          | 'license'
          | 'customization'
          | 'additional_service';
        status: string;
        pending_amount: number;
        payment_identifier?: string | number;
        client_name?: string;
        product_name?: string;
        [key: string]: any;
      }> = [];

      // AMCs - only process if we should fetch AMC
      if (shouldFetchAMC) {
        for (const amc of pendingAMCs) {
          if (Array.isArray(amc.payments)) {
            amc.payments.forEach((payment, index) => {
              if (payment.status === PAYMENT_STATUS_ENUM.PENDING) {
                pendingPayments.push({
                  _id: amc._id.toString(),
                  type: 'amc',
                  status: PAYMENT_STATUS_ENUM.PENDING,
                  pending_amount: amc.amount || 0, // AMC total amount
                  payment_identifier: index, // Index of the pending payment installment
                  payment_date: payment.from_date, // Due date of this installment
                  name: `AMC no ${index + 1}`, // Name of the installment
                  client_name: (amc.client_id as any)?.name || 'N/A',
                  product_name:
                    (amc.products as unknown as ProductDocument[])
                      ?.map((p) => p.short_name)
                      .join(', ') || 'N/A',
                });
              }
            });
          }
        }
      }

      // Only process other types if we should fetch them
      if (shouldFetchOtherTypes) {
        // Licenses
        for (const license of pendingLicenses) {
          const licenseCost =
            (license.rate?.amount || 0) * (license.total_license || 0);
          const order = license.order_id as any;
          pendingPayments.push({
            _id: license._id.toString(),
            type: 'license',
            status: license.payment_status,
            pending_amount: licenseCost,
            payment_identifier: license._id.toString(),
            payment_date: license.purchase_date,
            name:
              (license?.product_id as unknown as ProductDocument)?.short_name ??
              '',
            client_name: order?.client_id?.name || 'N/A',
            product_name:
              (license?.product_id as unknown as ProductDocument)?.short_name ??
              'N/A',
          });
        }

        // Customizations
        for (const customization of pendingCustomizations) {
          const order = customization.order_id as any;
          pendingPayments.push({
            _id: customization._id.toString(),
            type: 'customization',
            status: customization.payment_status,
            pending_amount: customization.cost || 0,
            payment_identifier: customization?._id?.toString(),
            payment_date: customization.purchased_date,
            name: customization?.title ?? '',
            client_name: order?.client_id?.name || 'N/A',
            product_name:
              (customization?.product_id as unknown as ProductDocument)
                ?.short_name ?? 'N/A',
          });
        }

        // Additional Services
        for (const service of pendingServices) {
          const order = service.order_id as any;
          pendingPayments.push({
            _id: service._id.toString(),
            type: 'additional_service',
            status: service.payment_status,
            pending_amount: service.cost || 0,
            payment_identifier: service._id.toString(),
            payment_date: service.purchased_date,
            name: service.name,
            client_name: order?.client_id?.name || 'N/A',
            product_name: service.name || 'N/A', // Or a product if linked
          });
        }
      }

      // Orders - only process if we should fetch order
      if (shouldFetchOrder) {
        for (const order of pendingOrders) {
          if (Array.isArray(order.payment_terms)) {
            order.payment_terms.forEach((term, index) => {
              if (
                term.status === PAYMENT_STATUS_ENUM.PENDING &&
                term.calculated_amount
              ) {
                pendingPayments.push({
                  _id: order._id.toString(),
                  type: 'order',
                  status: PAYMENT_STATUS_ENUM.PENDING,
                  pending_amount: term.calculated_amount,
                  payment_identifier: index, // Index of the payment term
                  payment_date: term.invoice_date, // Due date of this term
                  name: term.name, // Name of the payment term
                  client_name: (order.client_id as any)?.name || 'N/A',
                  product_name:
                    (order.products as unknown as ProductDocument[])
                      ?.map((p) => p.short_name)
                      .join(', ') || 'N/A',
                });
              }
            });
          }
        }
      }

      // Calculate the total based on the filtered data
      const totalCount = // Sum of filtered counts
        totalAMCs +
        totalLicenses +
        totalCustomizations +
        totalServices +
        totalOrders;

      const totalPages = Math.ceil(totalCount / limit); // Use overall limit for total pages

      this.loggerService.log(
        JSON.stringify({
          message:
            'getAllPendingPayments: Successfully fetched pending payments with filters.',
          data: {
            returnedCount: pendingPayments.length,
            totalFilteredCount: totalCount,
            page,
            limit,
            totalPages,
            filtersApplied: filters,
          },
        }),
      );

      return {
        pending_payments: pendingPayments, // These are from the per-schema paginated fetches
        pagination: {
          total: totalCount, // Total based on all filtered items
          currentPage: page,
          totalPages,
          limit, // Overall limit requested by user
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getAllPendingPayments: Error fetching pending payments',
          error: error.message,
          stack: error.stack,
          filters, // Log filters on error
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updatePendingPayment(
    id: string,
    type: IPendingPaymentTypes,
    payment_identifier: string | number,
    updateData: {
      status: PAYMENT_STATUS_ENUM;
      payment_receive_date: string;
    },
  ) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'updatePendingPayment: Starting payment update',
          type,
          payment_identifier,
          updateData,
        }),
      );

      let updatedPayment;
      const paymentReceiveDate = new Date(updateData.payment_receive_date);

      switch (type) {
        case 'amc':
          updatedPayment = await this.amcModel.findByIdAndUpdate(id, {
            [`payments.${payment_identifier}.status`]: updateData.status,
            [`payments.${payment_identifier}.payment_receive_date`]:
              paymentReceiveDate,
          });

          break;
        case 'order':
          updatedPayment = await this.orderModel.findByIdAndUpdate(id, {
            [`payment_terms.${payment_identifier}.status`]: updateData.status,
            [`payment_terms.${payment_identifier}.payment_receive_date`]:
              paymentReceiveDate,
          });
          break;
        case 'license':
          updatedPayment = await this.licenseModel.findByIdAndUpdate(id, {
            payment_status: updateData.status,
            payment_receive_date: paymentReceiveDate,
          });
          break;
        case 'customization':
          updatedPayment = await this.customizationModel.findByIdAndUpdate(
            id,
            {
              payment_status: updateData.status,
              payment_receive_date: paymentReceiveDate,
            },
            { new: true },
          );
          break;
        case 'additional_service':
          updatedPayment = await this.additionalServiceModel.findByIdAndUpdate(
            id,
            {
              payment_status: updateData.status,
              payment_receive_date: paymentReceiveDate,
            },
          );
          break;
        default:
          throw new HttpException(
            'Invalid payment type',
            HttpStatus.BAD_REQUEST,
          );
      }

      if (!updatedPayment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'updatePendingPayment: Payment updated successfully',
          type,
          payment_identifier,
        }),
      );

      return updatedPayment;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'updatePendingPayment: Error updating payment',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAmcReviewByOrderId(orderId: string): Promise<
    {
      from_date: Date;
      to_date: Date;
      status: PAYMENT_STATUS_ENUM;
      amc_rate_applied: number;
      amc_rate_amount: number;
      amc_frequency: number;
      total_cost: number;
      is_inactive?: boolean;
    }[]
  > {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getAmcReviewByOrderId: Starting function execution',
          data: { orderId },
        }),
      );

      // Fetch order with populated relationships
      const order = await this.orderModel.findById(orderId).populate([
        {
          path: 'customizations',
          model: Customization.name,
        },
        {
          path: 'licenses',
          model: License.name,
        },
        {
          path: 'client_id',
          model: Client.name,
          select: 'amc_frequency_in_months',
        },
      ]);

      if (!order) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getAmcReviewByOrderId: Order not found',
            data: { orderId },
          }),
        );
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'getAmcReviewByOrderId: Order found successfully',
          data: { orderId, orderNumber: order._id },
        }),
      );

      // Verify AMC exists
      const amc = await this.amcModel.findById(order.amc_id);
      if (!amc) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getAmcReviewByOrderId: AMC not found',
            data: { orderId, amcId: order.amc_id },
          }),
        );
        throw new HttpException('AMC not found', HttpStatus.NOT_FOUND);
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'getAmcReviewByOrderId: AMC found successfully',
          data: { orderId, amcId: amc._id },
        }),
      );

      // Get years for comparison
      const currentYear = new Date().getFullYear();
      const amcStartDateYear = new Date(order.amc_start_date).getFullYear();

      // Get AMC frequency from client settings or default to yearly
      const amc_frequency_in_months =
        (order.client_id as any)?.amc_frequency_in_months || 12;

      this.loggerService.log(
        JSON.stringify({
          message: 'getAmcReviewByOrderId: Starting Review Process',
          data: {
            orderId,
            amcStartDateYear,
            currentYear,
            amcFrequencyInMonths: amc_frequency_in_months,
          },
        }),
      );

      // Check for last agreement in the order to determine end year
      const agreements = order.agreements || [];
      const lastAgreement =
        agreements.length > 0 ? agreements[agreements.length - 1] : null;

      // Determine end year based on either agreement or current year
      let endYear = currentYear + 1;
      if (lastAgreement) {
        const agreementEndYear = new Date(lastAgreement.end).getFullYear();
        endYear = Math.max(agreementEndYear, endYear);

        this.loggerService.log(
          JSON.stringify({
            message:
              'getAmcReviewByOrderId: Agreement found, adjusting end year',
            data: {
              orderId,
              agreementEndDate: lastAgreement.end,
              agreementEndYear,
              calculatedEndYear: endYear,
              totalAgreements: agreements.length,
            },
          }),
        );
      } else {
        this.loggerService.log(
          JSON.stringify({
            message:
              'getAmcReviewByOrderId: No agreements found, using default end year',
            data: {
              orderId,
              endYear,
            },
          }),
        );
      }

      // Ensure the payment schedule covers at least one full AMC cycle after the start date.
      // If the AMC starts in a future year that is equal to or beyond the computed endYear,
      // extend the endYear so that the while-loop below generates at least one payment period.
      if (amcStartDateYear >= endYear) {
        endYear = amcStartDateYear + 1;
      }

      // Process status logs to identify inactive periods
      const inactivePeriods = [];
      if (order.status_logs && order.status_logs.length > 0) {
        this.loggerService.log(
          JSON.stringify({
            message:
              'getAmcReviewByOrderId: Processing status logs to identify inactive periods',
            data: {
              orderId,
              statusLogsCount: order.status_logs.length,
            },
          }),
        );

        let inactiveStartDate = null;

        // Extract inactive periods from status logs
        for (const log of order.status_logs) {
          // If status changed to inactive, mark the start of inactive period
          if (log.to === ORDER_STATUS_ENUM.INACTIVE) {
            inactiveStartDate = new Date(log.date);

            this.loggerService.log(
              JSON.stringify({
                message:
                  'getAmcReviewByOrderId: Detected transition to inactive status',
                data: {
                  orderId,
                  inactiveStartDate,
                  statusChange: `${log.from} → ${log.to}`,
                  logDate: log.date,
                },
              }),
            );
          }

          // If status changed from inactive to active, calculate the inactive period
          if (log.from === ORDER_STATUS_ENUM.INACTIVE && inactiveStartDate) {
            const inactivePeriod = {
              start: new Date(inactiveStartDate),
              end: new Date(log.date),
            };

            inactivePeriods.push(inactivePeriod);
            inactiveStartDate = null;

            this.loggerService.log(
              JSON.stringify({
                message:
                  'getAmcReviewByOrderId: Detected reactivation, added inactive period',
                data: {
                  orderId,
                  inactivePeriod,
                  statusChange: `${log.from} → ${log.to}`,
                  logDate: log.date,
                },
              }),
            );
          }
        }

        // If there's an open inactive period (no reactivation), consider it until current date
        if (inactiveStartDate) {
          const currentDate = new Date();
          inactivePeriods.push({
            start: new Date(inactiveStartDate),
            end: currentDate,
          });

          this.loggerService.log(
            JSON.stringify({
              message:
                'getAmcReviewByOrderId: Added open-ended inactive period until current date',
              data: {
                orderId,
                inactivePeriod: {
                  start: inactiveStartDate,
                  end: currentDate,
                },
              },
            }),
          );
        }

        this.loggerService.log(
          JSON.stringify({
            message: 'getAmcReviewByOrderId: Identified inactive periods',
            data: {
              orderId,
              inactivePeriods,
              inactivePeriodsCount: inactivePeriods.length,
              statusLogsCount: order.status_logs.length,
            },
          }),
        );
      } else {
        this.loggerService.log(
          JSON.stringify({
            message: 'getAmcReviewByOrderId: No status logs found',
            data: { orderId },
          }),
        );
      }

      this.loggerService.log(
        JSON.stringify({
          message:
            'getAmcReviewByOrderId: Starting payment schedule generation',
          data: {
            orderId,
            amcStartDate: order.amc_start_date,
            endYear,
          },
        }),
      );

      const payments = [];

      // Initialize date tracking
      let lastToDate = new Date(order.amc_start_date);
      let index = 0;

      // Generate payment schedule from start date to end year
      while (lastToDate.getFullYear() < endYear) {
        const from_date = new Date(lastToDate);
        const to_date = this.getNextDate(from_date, amc_frequency_in_months);

        // Check if this payment period overlaps with any inactive period
        let is_inactive = false;
        for (const period of inactivePeriods) {
          // Check for significant overlap between payment period and inactive period
          // A payment is only considered inactive if it falls completely within an inactive period
          // or if most of it falls within the inactive period (>50% overlap)
          const isMostlyWithinInactivePeriod =
            // Either payment period is fully contained within inactive period
            (from_date >= period.start && to_date <= period.end) ||
            // Or payment period starts before inactive period but mostly falls within it
            (from_date < period.start &&
              to_date > period.start &&
              // More than half of payment falls in inactive period
              to_date.getTime() - period.start.getTime() >
                period.start.getTime() - from_date.getTime()) ||
            // Or payment period ends after inactive period but mostly falls within it
            (from_date < period.end &&
              to_date > period.end &&
              // More than half of payment falls in inactive period
              period.end.getTime() - from_date.getTime() >
                to_date.getTime() - period.end.getTime());

          if (isMostlyWithinInactivePeriod) {
            is_inactive = true;
            this.loggerService.log(
              JSON.stringify({
                message:
                  'getAmcReviewByOrderId: Payment period overlaps significantly with inactive period',
                data: {
                  orderId,
                  paymentPeriod: { from: from_date, to: to_date },
                  inactivePeriod: period,
                  paymentIndex: index,
                },
              }),
            );
            break;
          }
        }

        // Add the payment with inactive flag if applicable
        payments.push({
          from_date: from_date.toDateString(),
          to_date: to_date.toDateString(),
          status: PAYMENT_STATUS_ENUM.PAID,
          amc_frequency: amc_frequency_in_months,
          is_inactive: is_inactive,
        });

        lastToDate = to_date;
        index++;
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'getAmcReviewByOrderId: Generated payment schedule',
          data: {
            orderId,
            paymentsCount: payments.length,
            inactivePaymentsCount: payments.filter((p) => p.is_inactive).length,
          },
        }),
      );

      // If no payments were generated (which can happen when the AMC start date is in the future
      // and endYear adjustment was not enough for an iteration), generate the first payment period
      // manually so that downstream logic always has at least one payment to work with.
      if (payments.length === 0) {
        const from_date = new Date(order.amc_start_date);
        const to_date = this.getNextDate(from_date, amc_frequency_in_months);

        payments.push({
          from_date: from_date.toDateString(),
          to_date: to_date.toDateString(),
          status: PAYMENT_STATUS_ENUM.PENDING, // First payment is pending by default
          amc_frequency: amc_frequency_in_months,
          is_inactive: false,
        });

        this.loggerService.log(
          JSON.stringify({
            message:
              'getAmcReviewByOrderId: No payments generated by loop, added initial payment',
            data: {
              orderId,
              from_date: from_date.toISOString(),
              to_date: to_date.toISOString(),
            },
          }),
        );
      }

      console.log(payments)
      // Ensure the most recent payment is marked as pending
      payments[payments.length - 1].status = PAYMENT_STATUS_ENUM.PENDING;

      this.loggerService.log(
        JSON.stringify({
          message:
            'getAmcReviewByOrderId: Marked most recent payment as pending',
          data: {
            orderId,
            pendingPaymentPeriod: {
              from: payments[payments.length - 1].from_date,
              to: payments[payments.length - 1].to_date,
            },
          },
        }),
      );

      // Initialize AMC rate tracking
      let currentAmcRate = order.amc_rate; // Start with current rate

      this.loggerService.log(
        JSON.stringify({
          message: 'getAmcReviewByOrderId: Starting AMC rate calculation',
          data: {
            orderId,
            currentAmcRate,
            hasRateHistory:
              order.amc_rate_history && order.amc_rate_history.length > 0,
          },
        }),
      );

      // Check if historical rates exist
      if (order.amc_rate_history && order.amc_rate_history.length > 0) {
        this.loggerService.log(
          JSON.stringify({
            message: 'getAmcReviewByOrderId: Processing historical AMC rates',
            data: {
              orderId,
              rateHistoryCount: order.amc_rate_history.length,
            },
          }),
        );

        let currentHistoryInCheckIndex = order.amc_rate_history.length - 1;
        let currentHistoryInCheck =
          order.amc_rate_history[currentHistoryInCheckIndex];

        // Process payments in reverse order to apply historical rates
        for (let i = payments.length - 1; i >= 0; i--) {
          const payment = payments[i];
          const fromYear = new Date(payment.from_date).getFullYear();
          const historyDateChangeYear = new Date(
            currentHistoryInCheck.date,
          ).getFullYear();

          // Check if payment year matches a rate change year
          const difference = fromYear - historyDateChangeYear;

          if (difference === 0) {
            // Update current rate to historical rate
            currentAmcRate = {
              percentage: currentHistoryInCheck.percentage,
              amount: currentHistoryInCheck.amount,
            };

            this.loggerService.log(
              JSON.stringify({
                message: 'getAmcReviewByOrderId: Applied historical AMC rate',
                data: {
                  orderId,
                  paymentYear: fromYear,
                  rateChangeYear: historyDateChangeYear,
                  updatedRate: currentAmcRate,
                  paymentIndex: i,
                },
              }),
            );

            // Move to next historical rate if available
            if (currentHistoryInCheckIndex > 0) {
              currentHistoryInCheckIndex = currentHistoryInCheckIndex - 1;
              currentHistoryInCheck =
                order.amc_rate_history[currentHistoryInCheckIndex];
            }
          }

          // Apply current rate to payment
          payment.amc_rate_applied = currentAmcRate.percentage;
          payment.amc_rate_amount = currentAmcRate.amount;
          payment.total_cost = order.base_cost;
        }
      } else {
        // If no historical rates, apply current rate to all payments
        this.loggerService.log(
          JSON.stringify({
            message:
              'getAmcReviewByOrderId: No historical rates found, applying current rate to all payments',
            data: {
              orderId,
              currentRate: currentAmcRate,
            },
          }),
        );

        for (const payment of payments) {
          payment.amc_rate_applied = currentAmcRate.percentage;
          payment.amc_rate_amount = currentAmcRate.amount;
          payment.total_cost = order.base_cost;
        }
      }

      this.loggerService.log(
        JSON.stringify({
          message:
            'getAmcReviewByOrderId: Processing customizations and licenses for additional costs',
          data: {
            orderId,
            customizationsCount: order.customizations?.length || 0,
            licensesCount: order.licenses?.length || 0,
          },
        }),
      );

      // Now Calculating Additional Purchase on the Order
      const customizations =
        order.customizations as unknown as CustomizationDocument[];

      for (const customization of customizations) {
        const customizationYear = new Date(
          customization.purchased_date,
        ).getFullYear();
        const paymentIndex = payments.findIndex((payment) => {
          const paymentYear = new Date(payment.from_date).getFullYear();
          return paymentYear === customizationYear;
        });

        this.loggerService.log(
          JSON.stringify({
            message: 'getAmcReviewByOrderId: Processing customization cost',
            data: {
              orderId,
              customizationId: customization._id,
              customizationYear,
              customizationCost: customization.cost,
              affectedPaymentsCount: payments.length - (paymentIndex + 1),
            },
          }),
        );

        for (let i = paymentIndex + 1; i < payments.length; i++) {
          const payment = payments[i];
          const newTotalCost = payment.total_cost + customization.cost;
          const newAmount = (newTotalCost / 100) * payment.amc_rate_applied;

          payment.amc_rate_amount = newAmount;
          payment.total_cost = newTotalCost;
        }
      }

      const licenses = order.licenses as unknown as LicenseDocument[];

      for (const license of licenses) {
        const licenseYear = new Date(license.purchase_date).getFullYear();
        const paymentIndex = payments.findIndex((payment) => {
          const paymentYear = new Date(payment.from_date).getFullYear();
          return paymentYear === licenseYear;
        });

        const licenseCost = license.rate?.amount * license.total_license;

        this.loggerService.log(
          JSON.stringify({
            message: 'getAmcReviewByOrderId: Processing license cost',
            data: {
              orderId,
              licenseId: license._id,
              licenseYear,
              licenseCost,
              totalLicenses: license.total_license,
              licenseRate: license.rate?.amount,
              affectedPaymentsCount: payments.length - (paymentIndex + 1),
            },
          }),
        );

        for (let i = paymentIndex + 1; i < payments.length; i++) {
          const payment = payments[i];

          const newTotalCost = payment.total_cost + licenseCost;
          const newAmount = (newTotalCost / 100) * payment.amc_rate_applied;

          payment.amc_rate_amount = newAmount;
          payment.total_cost = newTotalCost;
        }
      }

      // Filter out payments during inactive periods if needed
      // Note: We keep them in the response but marked with is_inactive flag
      // so the client can display them appropriately

      this.loggerService.log(
        JSON.stringify({
          message: 'getAmcReviewByOrderId: Completed payment calculation',
          data: {
            orderId,
            totalPayments: payments.length,
            inactivePayments: payments.filter((p) => p.is_inactive).length,
            totalPaymentAmount: payments.reduce(
              (sum, p) => sum + p.amc_rate_amount,
              0,
            ),
          },
        }),
      );

      // Filter out payments that are fully within inactive periods
      // but keep the payments that are at the edges (right before inactive period starts or right after it ends)
      const activePayments = payments.filter((payment) => {
        // Keep non-inactive payments
        if (!payment.is_inactive) return true;

        // For inactive payments, check if they are at the edges of inactive periods
        for (const period of inactivePeriods) {
          // Is this payment right before an inactive period? (prepaid period)
          const isRightBeforeInactivePeriod = isSameDay(
            payment.to_date,
            period.start,
          );

          // Is this payment right after an inactive period? (reactivation period)
          const isRightAfterInactivePeriod = isSameDay(
            payment.from_date,
            period.end,
          );

          // Keep the payment if it's at the edge of an inactive period
          if (isRightBeforeInactivePeriod || isRightAfterInactivePeriod) {
            return true;
          }
        }

        // Otherwise filter out the inactive payment
        return false;
      });

      this.loggerService.log(
        JSON.stringify({
          message:
            'getAmcReviewByOrderId: Filtered out fully inactive payments',
          data: {
            orderId,
            originalPaymentsCount: payments.length,
            activePaymentsCount: activePayments.length,
            removedInactivePaymentsCount:
              payments.length - activePayments.length,
          },
        }),
      );

      return activePayments;
    } catch (error: any) {
      console.log(error);
      this.loggerService.error(
        JSON.stringify({
          message:
            'getAmcReviewByOrderId: Error getting amc review by order id',
          data: {
            orderId,
            error: error.message,
            stack: error.stack,
          },
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async addPaymentsIntoAmc(amcId: string, payments: AddAMCPaymentDto[]) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'addPaymentsIntoAmc: Starting to add payments into AMC',
          data: { amcId, paymentsCount: payments.length },
        }),
      );

      const amc = await this.amcModel.findById(amcId);

      if (!amc) {
        this.loggerService.warn(
          JSON.stringify({
            message: 'addPaymentsIntoAmc: AMC not found',
            data: { amcId },
          }),
        );
        throw new HttpException('AMC not found', HttpStatus.NOT_FOUND);
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'addPaymentsIntoAmc: Found AMC, updating payments',
          data: { amcId },
        }),
      );

      amc.payments = payments;
      await amc.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'addPaymentsIntoAmc: Successfully updated AMC payments',
          data: { amcId, paymentsCount: payments.length },
        }),
      );

      return amc;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'addPaymentsIntoAmc: Error adding payments into amc',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** *********************************** TEMPORARY FUNCTIONS *********************************** */

  async deleteAllOrdersForAllClients() {
    try {
      this.loggerService.log(
        JSON.stringify({
          message:
            'deleteAllOrdersForAllClients: Starting deletion process for all clients',
        }),
      );

      // Get all clients
      const clients = await this.clientModel.find();

      for (const client of clients) {
        // Get all orders for this client
        const orders = client.orders;

        if (orders && orders.length > 0) {
          for (const orderId of orders) {
            // Delete the order and its related documents
            try {
              // Get the order and its related documents
              const order = await this.orderModel.findById(orderId);
              if (order) {
                // Delete related licenses
                if (order.licenses?.length) {
                  await this.licenseModel.deleteMany({
                    _id: { $in: order.licenses },
                  });
                }

                // Delete related customizations
                if (order.customizations?.length) {
                  await this.customizationModel.deleteMany({
                    _id: { $in: order.customizations },
                  });
                }

                // Delete related additional services
                if (order.additional_services?.length) {
                  await this.additionalServiceModel.deleteMany({
                    _id: { $in: order.additional_services },
                  });
                }

                // Delete related AMC
                if (order.amc_id) {
                  await this.amcModel.findByIdAndDelete(order.amc_id);
                }

                // Delete the order itself
                await this.orderModel.findByIdAndDelete(orderId);
              }
            } catch (error: any) {
              this.loggerService.error(
                JSON.stringify({
                  message: `Error deleting order ${orderId} for client ${client._id}`,
                  error: error.message,
                }),
              );
            }
          }

          // Clear the orders and amcs arrays from client
          await this.clientModel.findByIdAndUpdate(client._id, {
            $set: { orders: [], amcs: [] },
          });
        }
      }

      this.loggerService.log(
        JSON.stringify({
          message:
            'deleteAllOrdersForAllClients: Successfully completed deletion process',
        }),
      );

      return {
        message: 'All orders and related documents deleted successfully',
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message:
            'deleteAllOrdersForAllClients: Error during deletion process',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async migrateOrderData() {
    try {
      // const orders = await this.orderModel.find({}).lean();
      // for (const order of orders) {
      //   const amc_rate = order['amc_rates'];
      //   if (amc_rate) {
      //     console.log('Migrating order data', order._id);
      //     (order['amc_rate'] = {
      //       percentage: amc_rate.percentage,
      //       amount: amc_rate.amount,
      //     }),
      //       // remove amc_rate from order and add amc_rates to order
      //       await this.orderModel.findByIdAndUpdate(order._id, {
      //         $unset: { amc_rates: 1 },
      //         amc_rate: order['amc_rate'],
      //       });
      //   }
      // }
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'migrateOrderData: Error migrating order data',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async removeClientsData() {
    try {
      // update amc.payments to empty array
      await this.amcModel.updateMany({}, { $set: { payments: [] } });
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'removeClientsData: Error removing clients data',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteOrderById(orderId: string) {
    if (!orderId) {
      this.loggerService.error(
        JSON.stringify({
          message: 'deleteOrderById: Order id is required',
        }),
      );
      throw new HttpException('Order id is required', HttpStatus.BAD_REQUEST);
    }

    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'deleteOrderById: Starting deletion process',
          orderId,
        }),
      );

      // Find the order
      const order = await this.orderModel.findById(orderId);
      if (!order) {
        this.loggerService.error(
          JSON.stringify({
            message: 'deleteOrderById: Order not found',
            orderId,
          }),
        );
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      // Get client ID for later updating the client
      const clientId = order.client_id;

      // Delete related licenses
      if (order.licenses?.length) {
        this.loggerService.log(
          JSON.stringify({
            message: 'deleteOrderById: Deleting licenses',
            orderId,
            licenseIds: order.licenses,
          }),
        );
        await this.licenseModel.deleteMany({
          _id: { $in: order.licenses },
        });
      }

      // Delete related customizations
      if (order.customizations?.length) {
        this.loggerService.log(
          JSON.stringify({
            message: 'deleteOrderById: Deleting customizations',
            orderId,
            customizationIds: order.customizations,
          }),
        );
        await this.customizationModel.deleteMany({
          _id: { $in: order.customizations },
        });
      }

      // Delete related additional services
      if (order.additional_services?.length) {
        this.loggerService.log(
          JSON.stringify({
            message: 'deleteOrderById: Deleting additional services',
            orderId,
            additionalServiceIds: order.additional_services,
          }),
        );
        await this.additionalServiceModel.deleteMany({
          _id: { $in: order.additional_services },
        });
      }

      // Delete related AMC
      if (order.amc_id) {
        this.loggerService.log(
          JSON.stringify({
            message: 'deleteOrderById: Deleting AMC',
            orderId,
            amcId: order.amc_id,
          }),
        );
        await this.amcModel.findByIdAndDelete(order.amc_id);
      }

      // Delete any reminders related to this order
      this.loggerService.log(
        JSON.stringify({
          message: 'deleteOrderById: Deleting related reminders',
          orderId,
        }),
      );

      // Since Reminder model isn't directly injected in this service
      // Get the Reminder model using connection from one of our other models

      await this.reminderModel.deleteMany({
        $or: [
          { order_id: orderId },
          { license_id: { $in: order.licenses || [] } },
          { customization_id: { $in: order.customizations || [] } },
          { amc_id: order.amc_id },
        ],
      });

      // Update client to remove this order and AMC
      if (clientId) {
        this.loggerService.log(
          JSON.stringify({
            message: 'deleteOrderById: Updating client',
            orderId,
            clientId,
          }),
        );
        await this.clientModel.findByIdAndUpdate(clientId, {
          $pull: {
            orders: orderId,
            amcs: order.amc_id,
          },
        });
      }

      // Delete the order itself
      this.loggerService.log(
        JSON.stringify({
          message: 'deleteOrderById: Deleting order',
          orderId,
        }),
      );
      await this.orderModel.findByIdAndDelete(orderId);

      this.loggerService.log(
        JSON.stringify({
          message: 'deleteOrderById: Order deleted successfully',
          orderId,
        }),
      );

      return {
        message: 'Order and related documents deleted successfully',
        orderId,
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'deleteOrderById: Error during deletion process',
          orderId,
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCompanyFilterData(): Promise<{
    clients: { _id: string; name: string }[];
    parents: { _id: string; name: string }[];
  }> {
    try {
      this.loggerService.log(
        JSON.stringify({
          message:
            'getCompanyFilterData: Fetching client and parent company data for filters',
        }),
      );

      // Fetch all clients, selecting only necessary fields and populating parent name
      const clients = await this.clientModel
        .find()
        .select('_id name parent_company_id')
        .lean(); // Use lean for performance

      const clientCompanyMap = new Map<string, { _id: string; name: string }>();
      const parentCompanyMap = new Map<string, { _id: string; name: string }>();

      for (const client of clients) {
        // Ensure client has a valid _id before adding to map
        if (client._id) {
          const clientIdStr = client._id.toString();
          // Add client to client list
          if (!clientCompanyMap.has(clientIdStr)) {
            clientCompanyMap.set(clientIdStr, {
              _id: clientIdStr,
              name: client.name || 'Unnamed Client',
            });
          }
        }

        // Add parent company to parent list if it exists and has valid _id
        if (client.parent_company_id && client.parent_company_id._id) {
          const parentCompany = await this.clientModel
            .findById(client.parent_company_id._id)
            .select('name')
            .lean();
          if (parentCompany) {
            const parentIdStr = client.parent_company_id._id.toString();
            if (!parentCompanyMap.has(parentIdStr)) {
              parentCompanyMap.set(parentIdStr, {
                _id: parentIdStr,
                name: parentCompany.name || 'Unnamed Parent Company',
              });
            }
          }
        }
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'getCompanyFilterData: Successfully aggregated company data',
          data: {
            clientCount: clientCompanyMap.size,
            parentCount: parentCompanyMap.size,
          },
        }),
      );

      return {
        clients: Array.from(clientCompanyMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        ), // Sort alphabetically
        parents: Array.from(parentCompanyMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        ), // Sort alphabetically
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getCompanyFilterData: Error fetching company filter data',
          error: error.message,
          stack: error.stack,
        }),
      );

      // Despite the error, try to return some data if possible
      try {
        // Fetch all clients without populating parent_company_id to avoid ObjectId cast errors
        const fallbackClients = await this.clientModel
          .find()
          .select('_id name')
          .lean();

        const clientCompanyMap = new Map<
          string,
          { _id: string; name: string }
        >();

        for (const client of fallbackClients) {
          if (client._id) {
            const clientIdStr = client._id.toString();
            if (!clientCompanyMap.has(clientIdStr)) {
              clientCompanyMap.set(clientIdStr, {
                _id: clientIdStr,
                name: client.name || 'Unnamed Client',
              });
            }
          }
        }

        return {
          clients: Array.from(clientCompanyMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
          parents: [], // Return empty array for parent companies in fallback mode
        };
      } catch (fallbackError: any) {
        // If even the fallback fails, return empty arrays
        this.loggerService.error(
          JSON.stringify({
            message: 'getCompanyFilterData: Fallback retrieval also failed',
            error: fallbackError.message,
          }),
        );

        throw new HttpException(
          'Error fetching company data for filters',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  async exportAmcToExcel(
    filters: AMC_FILTER[],
    options: {
      startDate?: Date | string;
      endDate?: Date | string;
      clientId?: string;
      productId?: string;
    } = {},
  ): Promise<Buffer> {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'exportAmcToExcel: Generating Excel export',
          filters,
          options,
        }),
      );

      // Import Excel library dynamically to avoid server-side issues
      const ExcelJS = require('exceljs');

      // Create a new Excel workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'AMC Management System';
      workbook.lastModifiedBy = 'AMC Management System';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('AMC Data', {
        properties: { tabColor: { argb: '4F81BD' } },
        pageSetup: {
          paperSize: 9, // A4
          orientation: 'landscape',
          fitToPage: true,
          fitToHeight: 0,
          fitToWidth: 1,
          margins: {
            left: 0.25,
            right: 0.25,
            top: 0.75,
            bottom: 0.75,
            header: 0.3,
            footer: 0.3,
          },
        },
      });

      // Build the query for AMC filtering - similar to loadAllAMC
      const activeOrders = await this.orderModel
        .find({ status: ORDER_STATUS_ENUM.ACTIVE })
        .distinct('_id');

      const amcQuery: any = {
        payments: { $exists: true },
        order_id: { $in: activeOrders },
      };

      // Add client_id filter if provided
      if (options.clientId) {
        try {
          amcQuery.client_id = new Types.ObjectId(options.clientId);
        } catch (error) {
          this.loggerService.error(
            JSON.stringify({
              message: 'exportAmcToExcel: Invalid client ID format',
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }

      // Add product_id filter if provided
      if (options.productId) {
        try {
          amcQuery.products = new Types.ObjectId(options.productId);
        } catch (error) {
          this.loggerService.error(
            JSON.stringify({
              message: 'exportAmcToExcel: Invalid product ID format',
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }

      // Fetch all AMCs with necessary relationships
      const allAmcs = await this.amcModel
        .find(amcQuery)
        .sort({ _id: -1 })
        .populate([
          {
            path: 'client_id',
            model: Client.name,
            select: 'name',
          },
          {
            path: 'order_id',
            model: Order.name,
            select: 'purchase_date amc_start_date',
          },
          {
            path: 'products',
            model: Product.name,
            select: 'name short_name',
          },
        ]);

      this.loggerService.log(
        JSON.stringify({
          message: 'exportAmcToExcel: Fetched AMCs for export',
          count: allAmcs.length,
        }),
      );

      // Process date filters
      const startDate =
        options.startDate && options.startDate !== 'undefined'
          ? new Date(options.startDate)
          : null;

      const endDate =
        options.endDate && options.endDate !== 'undefined'
          ? new Date(options.endDate)
          : null;

      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(23, 59, 59, 999);

      // Filter AMCs using the same logic as in loadAllAMC
      const matchingAmcIds = new Map<string, Set<AMC_FILTER>>();
      const totalAmountByFilter = {} as Record<string, number>;

      // Process each AMC
      for (const amc of allAmcs) {
        if (!Array.isArray(amc.payments) || amc.payments.length === 0) {
          continue;
        }

        const amcId = amc._id.toString();

        // Check this AMC against each filter type
        for (const filterType of filters) {
          let matches = false;
          let amcAmount = 0;

          switch (filterType) {
            case AMC_FILTER.PAID:
              // Check for PAID payments within date range
              const paidPayments = amc.payments.filter((payment) => {
                const paymentDate = new Date(payment.from_date);
                const dateInRange =
                  (!startDate || paymentDate >= startDate) &&
                  (!endDate || paymentDate <= endDate);

                return (
                  payment.status === PAYMENT_STATUS_ENUM.PAID &&
                  ((!startDate && !endDate) || dateInRange)
                );
              });

              matches = paidPayments.length > 0;
              amcAmount = paidPayments.reduce(
                (sum, payment) => sum + (payment.amc_rate_amount || 0),
                0,
              );
              break;

            case AMC_FILTER.PENDING:
              // Check for PENDING payments within date range
              const pendingPayments = amc.payments.filter((payment) => {
                const paymentDate = new Date(payment.from_date);
                const dateInRange =
                  (!startDate || paymentDate >= startDate) &&
                  (!endDate || paymentDate <= endDate);

                return (
                  payment.status === PAYMENT_STATUS_ENUM.PENDING &&
                  ((!startDate && !endDate) || dateInRange)
                );
              });

              matches = pendingPayments.length > 0;
              amcAmount = pendingPayments.reduce(
                (sum, payment) => sum + (payment.amc_rate_amount || 0),
                0,
              );
              break;

            case AMC_FILTER.PROFORMA:
              // Check for PROFORMA payments within date range
              const proformaPayments = amc.payments.filter((payment) => {
                const paymentDate = new Date(payment.from_date);
                const dateInRange =
                  (!startDate || paymentDate >= startDate) &&
                  (!endDate || paymentDate <= endDate);

                return (
                  payment.status === PAYMENT_STATUS_ENUM.proforma &&
                  ((!startDate && !endDate) || dateInRange)
                );
              });

              matches = proformaPayments.length > 0;
              amcAmount = proformaPayments.reduce(
                (sum, payment) => sum + (payment.amc_rate_amount || 0),
                0,
              );
              break;

            case AMC_FILTER.INVOICE:
              // Check for INVOICE payments within date range
              const invoicePayments = amc.payments.filter((payment) => {
                const paymentDate = new Date(payment.from_date);
                const dateInRange =
                  (!startDate || paymentDate >= startDate) &&
                  (!endDate || paymentDate <= endDate);

                return (
                  payment.status === PAYMENT_STATUS_ENUM.INVOICE &&
                  ((!startDate && !endDate) || dateInRange)
                );
              });

              matches = invoicePayments.length > 0;
              amcAmount = invoicePayments.reduce(
                (sum, payment) => sum + (payment.amc_rate_amount || 0),
                0,
              );
              break;
          }

          if (matches) {
            if (!matchingAmcIds.has(amcId)) {
              matchingAmcIds.set(amcId, new Set<AMC_FILTER>());
            }
            matchingAmcIds.get(amcId).add(filterType);

            // Add to total for this filter type
            totalAmountByFilter[filterType] =
              (totalAmountByFilter[filterType] || 0) + amcAmount;
          }
        }
      }

      // Calculate overall total
      const totalAmount = Object.values(totalAmountByFilter).reduce(
        (sum, amount) => sum + amount,
        0,
      );

      // Filter AMCs to those that match our criteria
      const filteredAmcs = allAmcs.filter((amc) =>
        matchingAmcIds.has(amc._id.toString()),
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'exportAmcToExcel: AMCs filtered for export',
          count: filteredAmcs.length,
          totalAmount,
        }),
      );

      // Define Excel styles
      const headerStyle: Partial<ExcelJS.Style> = {
        font: { bold: true, color: { argb: 'FFFFFF' } },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '4F81BD' },
        } as ExcelJS.FillPattern,
        border: {
          top: { style: 'thin' as ExcelJS.BorderStyle },
          left: { style: 'thin' as ExcelJS.BorderStyle },
          bottom: { style: 'thin' as ExcelJS.BorderStyle },
          right: { style: 'thin' as ExcelJS.BorderStyle },
        },
        alignment: { horizontal: 'center', vertical: 'middle' },
      };

      const dataStyle: Partial<ExcelJS.Style> = {
        border: {
          top: { style: 'thin' as ExcelJS.BorderStyle },
          left: { style: 'thin' as ExcelJS.BorderStyle },
          bottom: { style: 'thin' as ExcelJS.BorderStyle },
          right: { style: 'thin' as ExcelJS.BorderStyle },
        },
        alignment: { vertical: 'middle' },
      };

      const amountStyle: Partial<ExcelJS.Style> = {
        ...dataStyle,
        numFmt: '#,##0.00',
        alignment: { ...(dataStyle.alignment || {}), horizontal: 'right' },
      };

      const dateStyle: Partial<ExcelJS.Style> = {
        ...dataStyle,
        numFmt: 'dd-mmm-yyyy',
        alignment: { ...(dataStyle.alignment || {}), horizontal: 'center' },
      };

      const highlightStyle: Partial<ExcelJS.Style> = {
        ...dataStyle,
        font: { bold: true },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'E6F0FF' },
        } as ExcelJS.FillPattern,
      };

      const totalRowStyle: Partial<ExcelJS.Style> = {
        font: { bold: true },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDEBF7' },
        } as ExcelJS.FillPattern,
        border: {
          top: { style: 'thin' as ExcelJS.BorderStyle },
          left: { style: 'thin' as ExcelJS.BorderStyle },
          bottom: { style: 'double' as ExcelJS.BorderStyle },
          right: { style: 'thin' as ExcelJS.BorderStyle },
        },
        alignment: { vertical: 'middle' },
      };

      const totalAmountStyle: Partial<ExcelJS.Style> = {
        ...totalRowStyle,
        numFmt: '#,##0.00',
        alignment: { ...(totalRowStyle.alignment || {}), horizontal: 'right' },
      };

      // Add filter breakdown at the top
      worksheet.addRow(['AMC Export Report']).font = { size: 16, bold: true };
      worksheet.addRow(['Generated on:', new Date()]).getCell(2).style =
        dateStyle;

      worksheet.addRow([]);

      const filterRow = worksheet.addRow(['Filters Used:', filters.join(', ')]);
      filterRow.getCell(1).font = { bold: true };

      const dateRangeText =
        startDate && endDate
          ? `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
          : 'All dates';
      const dateRangeRow = worksheet.addRow(['Date Range:', dateRangeText]);
      dateRangeRow.getCell(1).font = { bold: true };

      worksheet.addRow([]);

      // Add amount summary section
      const summaryRow = worksheet.addRow(['Amount Summary']);
      summaryRow.font = { size: 14, bold: true };

      // Headers for amount summary
      const summaryHeaderRow = worksheet.addRow([
        'Filter Type',
        'Total Amount',
      ]);
      summaryHeaderRow.eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Add each filter amount
      Object.entries(totalAmountByFilter).forEach(([filter, amount]) => {
        const row = worksheet.addRow([filter, amount]);
        row.getCell(1).style = highlightStyle;
        row.getCell(2).style = amountStyle;
      });

      // Add total row
      const totalSummaryRow = worksheet.addRow(['TOTAL', totalAmount]);
      totalSummaryRow.getCell(1).style = totalRowStyle;
      totalSummaryRow.getCell(2).style = totalAmountStyle;

      worksheet.addRow([]);
      worksheet.addRow([]);

      // Define columns for the data table
      worksheet.columns = [
        { header: 'Client', key: 'client', width: 25 },
        { header: 'Product', key: 'product', width: 20 },
        { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
        { header: 'AMC Start Date', key: 'amcStartDate', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Payment From', key: 'paymentFrom', width: 15 },
        { header: 'Payment To', key: 'paymentTo', width: 15 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Filter Match', key: 'filterMatch', width: 20 },
      ];

      // Style the header row
      worksheet.getRow(worksheet.rowCount).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Add data rows - first collect all payment data
      const allPaymentRows = [];

      for (const amc of filteredAmcs) {
        // filteredAmcs contains AMCs that have at least ONE payment matching the criteria
        const clientName = (amc.client_id as any)?.name || 'Unknown Client';
        const productNames =
          (amc.products as any[])
            ?.map((p) => p.short_name || p.name)
            .join(', ') || 'Unknown Product';
        const purchaseDate = (amc.order_id as any)?.purchase_date;
        const amcStartDateValue = (amc.order_id as any)?.amc_start_date;

        // Iterate through each payment of this AMC
        for (const payment of amc.payments) {
          const paymentFromDate = new Date(payment.from_date);
          let paymentMatchedAnyOfTheUserFilters = false;
          const specificFiltersThisPaymentMatched = [];

          // Check this specific payment against each of the user's selected filters
          for (const filterType of filters) {
            const dateInRange =
              (!startDate || paymentFromDate >= startDate) &&
              (!endDate || paymentFromDate <= endDate);

            let currentFilterLogicMatch = false;
            switch (filterType) {
              case AMC_FILTER.PAID:
                currentFilterLogicMatch =
                  payment.status === PAYMENT_STATUS_ENUM.PAID &&
                  ((!startDate && !endDate) || dateInRange);
                break;
              case AMC_FILTER.PENDING:
                currentFilterLogicMatch =
                  payment.status === PAYMENT_STATUS_ENUM.PENDING &&
                  ((!startDate && !endDate) || dateInRange);
                break;
              case AMC_FILTER.PROFORMA:
                currentFilterLogicMatch =
                  payment.status === PAYMENT_STATUS_ENUM.proforma &&
                  ((!startDate && !endDate) || dateInRange);
                break;
              case AMC_FILTER.INVOICE:
                currentFilterLogicMatch =
                  payment.status === PAYMENT_STATUS_ENUM.INVOICE &&
                  ((!startDate && !endDate) || dateInRange);
                break;
            }

            if (currentFilterLogicMatch) {
              paymentMatchedAnyOfTheUserFilters = true;
              specificFiltersThisPaymentMatched.push(filterType);
            }
          }

          // If this specific payment matched any of the user-selected filters, add it to the Excel rows
          if (paymentMatchedAnyOfTheUserFilters) {
            allPaymentRows.push({
              client: clientName,
              product: productNames,
              purchaseDate,
              amcStartDate: amcStartDateValue,
              status: payment.status,
              paymentFrom: payment.from_date,
              paymentTo: payment.to_date,
              amount: payment.amc_rate_amount || 0,
              filterMatch: specificFiltersThisPaymentMatched.join(', '),
              isFilterMatch: true, // This payment is a direct match to the applied filters
            });
          }
        }
      }

      // Sort the data by client and payment date
      allPaymentRows.sort((a, b) => {
        if (a.client !== b.client) return a.client.localeCompare(b.client);
        return (
          new Date(a.paymentFrom).getTime() - new Date(b.paymentFrom).getTime()
        );
      });

      // Add all data rows
      for (const rowData of allPaymentRows) {
        const row = worksheet.addRow({
          client: rowData.client,
          product: rowData.product,
          purchaseDate: rowData.purchaseDate,
          amcStartDate: rowData.amcStartDate,
          status: rowData.status,
          paymentFrom: rowData.paymentFrom,
          paymentTo: rowData.paymentTo,
          amount: rowData.amount,
          filterMatch: rowData.filterMatch,
        });

        // Apply styles
        row.getCell('client').style = dataStyle;
        row.getCell('product').style = dataStyle;
        row.getCell('purchaseDate').style = dateStyle;
        row.getCell('amcStartDate').style = dateStyle;

        // Determine status cell style based on payment status
        let statusCellStyle: Partial<ExcelJS.Style> = {
          ...dataStyle, // Copy initial properties from dataStyle
          alignment: { horizontal: 'center', vertical: 'middle' },
        };

        switch (rowData.status) {
          case PAYMENT_STATUS_ENUM.PAID:
            statusCellStyle.font = { color: { argb: 'FFFFFF' } }; // White text
            statusCellStyle.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: '10B981' },
            } as ExcelJS.FillPattern; // Tailwind green-700 (approx)
            break;
          case PAYMENT_STATUS_ENUM.PENDING:
            statusCellStyle.font = { color: { argb: 'FFFFFF' } }; // White text
            statusCellStyle.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'EF4444' },
            } as ExcelJS.FillPattern; // Tailwind red-600 (approx)
            break;
          case PAYMENT_STATUS_ENUM.proforma:
            statusCellStyle.font = { color: { argb: '000000' } }; // Black text
            statusCellStyle.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'F59E0B' },
            } as ExcelJS.FillPattern; // Tailwind yellow-600 (approx)
            break;
          case PAYMENT_STATUS_ENUM.INVOICE:
            statusCellStyle.font = { color: { argb: 'FFFFFF' } }; // White text
            statusCellStyle.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: '3B82F6' },
            } as ExcelJS.FillPattern; // Tailwind blue-600 (approx)
            break;
        }
        row.getCell('status').style = statusCellStyle;

        row.getCell('paymentFrom').style = dateStyle;
        row.getCell('paymentTo').style = dateStyle;
        row.getCell('amount').style = amountStyle;

        // Apply special highlighting for rows that match filter criteria
        if (rowData.isFilterMatch) {
          row.getCell('filterMatch').style = {
            ...highlightStyle,
            font: { bold: true, color: { argb: '000000' } },
            fill: {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFEB9C' },
            }, // Light yellow
            alignment: { horizontal: 'center', vertical: 'middle' },
          };

          // Highlight the entire row with a very light yellow background
          [
            'client',
            'product',
            'purchaseDate',
            'amcStartDate',
            'paymentFrom',
            'paymentTo',
            'amount',
          ].forEach((cellKey) => {
            // Skip styling the status cell again as it has its own specific color
            if (cellKey === 'status') return;

            const currentStyle = row.getCell(cellKey).style;
            row.getCell(cellKey).style = {
              ...currentStyle,
              fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFDE6' },
              }, // Very light yellow
            };
          });
        } else {
          row.getCell('filterMatch').style = {
            ...dataStyle,
            font: { color: { argb: '808080' } }, // Gray text for non-matches
            alignment: { horizontal: 'center', vertical: 'middle' },
          };
        }
      }

      // Add a total row at the bottom
      const finalRow = worksheet.addRow({
        client: 'TOTAL',
        amount: totalAmount,
      });

      finalRow.getCell('client').style = totalRowStyle;
      finalRow.getCell('product').style = totalRowStyle;
      finalRow.getCell('purchaseDate').style = totalRowStyle;
      finalRow.getCell('amcStartDate').style = totalRowStyle;
      finalRow.getCell('status').style = totalRowStyle;
      finalRow.getCell('paymentFrom').style = totalRowStyle;
      finalRow.getCell('paymentTo').style = totalRowStyle;
      finalRow.getCell('amount').style = totalAmountStyle;
      finalRow.getCell('filterMatch').style = totalRowStyle;

      // Auto-filter the data table
      worksheet.autoFilter = {
        from: {
          row: worksheet.rowCount - allPaymentRows.length - 1,
          column: 1,
        },
        to: { row: worksheet.rowCount - 1, column: 9 },
      };

      // Generate the Excel file buffer
      const buffer = await workbook.xlsx.writeBuffer();

      this.loggerService.log(
        JSON.stringify({
          message: 'exportAmcToExcel: Excel export generated successfully',
          rowCount: worksheet.rowCount,
          paymentCount: allPaymentRows.length,
        }),
      );

      return buffer;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'exportAmcToExcel: Error generating Excel export',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        'Failed to generate Excel export: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createAmcPaymentsTillYear(amcId: string, tillYear: number) {
    try {
      // Validate and convert tillYear
      const validTillYear =
        typeof tillYear === 'string' ? parseInt(tillYear, 10) : tillYear;

      if (
        !validTillYear ||
        isNaN(validTillYear) ||
        validTillYear < 2000 ||
        validTillYear > 2100
      ) {
        this.loggerService.error(
          JSON.stringify({
            message: 'createAmcPaymentsTillYear: Invalid tillYear parameter',
            data: { amcId, tillYear, validTillYear, typeof: typeof tillYear },
          }),
        );
        throw new HttpException(
          'Invalid tillYear parameter. Must be a valid year between 2000 and 2100. current tillYear: ' +
            tillYear,
          HttpStatus.BAD_REQUEST,
        );
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'createAmcPaymentsTillYear: Starting AMC payments creation',
          data: { amcId, tillYear: validTillYear, originalTillYear: tillYear },
        }),
      );

      // Find AMC with populated order and client information
      const amc = await this.amcModel.findById(amcId).populate({
        path: 'order_id',
        model: Order.name,
        populate: [
          {
            path: 'customizations',
            model: Customization.name,
          },
          {
            path: 'licenses',
            model: License.name,
          },
          {
            path: 'client_id',
            model: Client.name,
            select: 'amc_frequency_in_months',
          },
        ],
      });

      if (!amc) {
        this.loggerService.error(
          JSON.stringify({
            message: 'createAmcPaymentsTillYear: AMC not found',
            data: { amcId },
          }),
        );
        throw new HttpException('AMC not found', HttpStatus.NOT_FOUND);
      }

      const order = amc.order_id as any;
      if (!order || !order.amc_start_date) {
        this.loggerService.error(
          JSON.stringify({
            message:
              'createAmcPaymentsTillYear: Order or AMC start date not found',
            data: { amcId, orderId: order?._id },
          }),
        );
        throw new HttpException(
          'Order or AMC start date not found',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Skip if payments array is empty - need at least one payment to continue from
      if (!amc.payments || amc.payments.length === 0) {
        this.loggerService.log(
          JSON.stringify({
            message:
              'createAmcPaymentsTillYear: Skipping AMC with empty payments array',
            data: { amcId },
          }),
        );
        return {
          amcId,
          newPaymentsCreated: 0,
          totalPayments: 0,
          tillYear: validTillYear,
          lastAmcPayment: null,
          amcStartDate: order.amc_start_date,
          message:
            'No payments exist - cannot create future payments without base payment',
        };
      }

      // Get AMC frequency from client settings or default to yearly (12 months)
      const amc_frequency_in_months =
        order.client_id?.amc_frequency_in_months || DEFAULT_AMC_CYCLE_IN_MONTHS;

      const lastPayment = amc.payments[amc.payments.length - 1];

      this.loggerService.log(
        JSON.stringify({
          message: 'createAmcPaymentsTillYear: Retrieved AMC and order details',
          data: {
            amcId,
            orderId: order._id,
            amcStartDate: order.amc_start_date,
            amcFrequency: amc_frequency_in_months,
            existingPaymentsCount: amc.payments.length,
            lastPaymentToDate: lastPayment.to_date,
            lastPaymentToDateYear: new Date(lastPayment.to_date).getFullYear(),
            tillYear: validTillYear,
          },
        }),
      );

      // Check if we need to add payments up to the target year
      const lastPaymentYear = new Date(lastPayment.to_date).getFullYear();

      if (lastPaymentYear >= validTillYear) {
        this.loggerService.log(
          JSON.stringify({
            message: 'createAmcPaymentsTillYear: No new payments needed',
            data: {
              amcId,
              tillYear: validTillYear,
              lastPaymentYear,
              message: 'Last payment already covers the target year or beyond',
            },
          }),
        );
        return {
          amcId,
          newPaymentsCreated: 0,
          totalPayments: amc.payments.length,
          tillYear: validTillYear,
          lastAmcPayment: lastPayment,
          amcStartDate: order.amc_start_date,
          message:
            'No new payments needed - payments already exist till specified year',
        };
      }

      // We need to add payments up to the target year
      let fromDate = new Date(lastPayment.to_date);

      this.loggerService.log(
        JSON.stringify({
          message:
            'createAmcPaymentsTillYear: Adding payments to cover target year',
          data: {
            amcId,
            lastPaymentToDate: fromDate,
            tillYear: validTillYear,
            lastPaymentYear,
          },
        }),
      );

      // Calculate total cost including customizations and licenses
      let totalCost = order.base_cost || 0;

      // Add customization costs
      const customizations = order.customizations || [];
      for (const customization of customizations) {
        totalCost += customization.cost || 0;
      }

      // Add license costs
      const licenses = order.licenses || [];
      for (const license of licenses) {
        const licenseCost =
          (license.rate?.amount || 0) * (license.total_license || 0);
        totalCost += licenseCost;
      }

      // Calculate AMC amount based on total cost
      const amcAmount = (totalCost / 100) * order.amc_rate.percentage;

      this.loggerService.log(
        JSON.stringify({
          message: 'createAmcPaymentsTillYear: Calculated AMC amounts',
          data: {
            amcId,
            totalCost,
            amcPercentage: order.amc_rate.percentage,
            amcAmount,
          },
        }),
      );

      const newPayments = [];
      let currentPaymentsCount = amc.payments.length;

      // Create new payments to cover the target year - similar to updateAMCPayments logic
      while (fromDate.getFullYear() < validTillYear) {
        const toDate = this.getNextDate(
          new Date(fromDate),
          amc_frequency_in_months,
        );

        const newPayment = {
          from_date: new Date(fromDate),
          to_date: toDate,
          status: PAYMENT_STATUS_ENUM.PENDING,
          amc_frequency: amc_frequency_in_months,
          total_cost: totalCost,
          amc_rate_applied: order.amc_rate.percentage,
          amc_rate_amount: amcAmount,
        };

        // Add the payment to the AMC
        await this.amcModel.findByIdAndUpdate(amc._id, {
          $push: { payments: newPayment },
          amount: amcAmount,
          total_cost: totalCost,
        });

        newPayments.push(newPayment);
        currentPaymentsCount++;

        this.loggerService.log(
          JSON.stringify({
            message: 'createAmcPaymentsTillYear: Added new payment',
            data: {
              amcId,
              newPayment,
              fromYear: fromDate.getFullYear(),
              toYear: toDate.getFullYear(),
            },
          }),
        );

        fromDate = toDate;

        // Safety check to prevent infinite loop
        if (fromDate.getFullYear() > validTillYear + 5) {
          this.loggerService.warn(
            JSON.stringify({
              message:
                'createAmcPaymentsTillYear: Breaking loop to prevent infinite iteration',
              data: {
                amcId,
                currentYear: fromDate.getFullYear(),
                tillYear: validTillYear,
              },
            }),
          );
          break;
        }
      }

      this.loggerService.log(
        JSON.stringify({
          message:
            'createAmcPaymentsTillYear: Successfully created AMC payments',
          data: {
            amcId,
            newPaymentsCount: newPayments.length,
            totalPaymentsCount: currentPaymentsCount,
            tillYear: validTillYear,
          },
        }),
      );

      // Get the updated AMC to return the latest payment
      const updatedAmc = await this.amcModel.findById(amcId);

      return {
        amcId,
        newPaymentsCreated: newPayments.length,
        totalPayments: currentPaymentsCount,
        tillYear: validTillYear,
        lastAmcPayment: updatedAmc.payments[updatedAmc.payments.length - 1],
        amcStartDate: order.amc_start_date,
        message:
          newPayments.length > 0
            ? `Successfully created ${newPayments.length} new payment(s)`
            : 'No new payments needed - payments already exist till specified year',
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'createAmcPaymentsTillYear: Error creating AMC payments',
          data: { amcId, tillYear },
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createAmcPaymentsTillYearForAllAmcs(tillYear: number) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message:
            'createAmcPaymentsTillYearForAllAmcs: Starting bulk AMC payments creation',
          data: { tillYear },
        }),
      );

      // Get all AMCs with basic information
      const allAmcs = await this.amcModel.find({}).select('_id order_id');

      if (!allAmcs || allAmcs.length === 0) {
        this.loggerService.log(
          JSON.stringify({
            message: 'createAmcPaymentsTillYearForAllAmcs: No AMCs found',
            data: { tillYear },
          }),
        );
        return {
          tillYear,
          totalAmcsProcessed: 0,
          successfulAmcs: 0,
          failedAmcs: 0,
          results: [],
          message: 'No AMCs found to process',
        };
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'createAmcPaymentsTillYearForAllAmcs: Found AMCs to process',
          data: {
            tillYear,
            totalAmcsFound: allAmcs.length,
          },
        }),
      );

      const results = [];
      let successfulAmcs = 0;
      let failedAmcs = 0;

      // Process each AMC
      for (const amc of allAmcs) {
        try {
          this.loggerService.log(
            JSON.stringify({
              message: 'createAmcPaymentsTillYearForAllAmcs: Processing AMC',
              data: {
                amcId: amc._id,
                tillYear,
              },
            }),
          );

          // Call the individual function for this AMC
          const result = await this.createAmcPaymentsTillYear(
            amc._id.toString(),
            tillYear,
          );

          results.push({
            amcId: amc._id,
            success: true,
            ...result,
          });

          successfulAmcs++;

          this.loggerService.log(
            JSON.stringify({
              message:
                'createAmcPaymentsTillYearForAllAmcs: Successfully processed AMC',
              data: {
                amcId: amc._id,
                newPaymentsCreated: result.newPaymentsCreated,
                tillYear,
              },
            }),
          );
        } catch (error: any) {
          failedAmcs++;

          this.loggerService.error(
            JSON.stringify({
              message:
                'createAmcPaymentsTillYearForAllAmcs: Failed to process AMC',
              data: {
                amcId: amc._id,
                tillYear,
                error: error.message,
              },
            }),
          );

          results.push({
            amcId: amc._id,
            success: false,
            error: error.message,
            tillYear,
          });
        }
      }

      const totalNewPayments = results
        .filter((r) => r.success)
        .reduce((sum, r) => sum + (r.newPaymentsCreated || 0), 0);

      this.loggerService.log(
        JSON.stringify({
          message:
            'createAmcPaymentsTillYearForAllAmcs: Completed bulk processing',
          data: {
            tillYear,
            totalAmcsProcessed: allAmcs.length,
            successfulAmcs,
            failedAmcs,
            totalNewPaymentsCreated: totalNewPayments,
          },
        }),
      );

      return {
        tillYear,
        totalAmcsProcessed: allAmcs.length,
        successfulAmcs,
        failedAmcs,
        totalNewPaymentsCreated: totalNewPayments,
        results,
        message: `Processed ${allAmcs.length} AMCs. ${successfulAmcs} successful, ${failedAmcs} failed. Created ${totalNewPayments} new payments total.`,
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message:
            'createAmcPaymentsTillYearForAllAmcs: Error in bulk processing',
          data: { tillYear },
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
