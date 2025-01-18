import {
  Customization,
  CustomizationDocument,
} from '@/db/schema/order/customization.schema';
import { License, LicenseDocument } from '@/db/schema/order/license.schema';
import { Order, OrderDocument } from '@/db/schema/order/product-order.schema';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
  ORDER_STATUS_ENUM,
  PURCHASE_TYPE,
} from '@/common/types/enums/order.enum';
import {
  AMC,
  AMCDocument,
  PAYMENT_STATUS_ENUM,
} from '@/db/schema/amc/amc.schema';
import { Types } from 'mongoose';
import { UpdateAMCDto } from '../dto/update-amc.dto';
import { extractS3Key } from '@/utils/misc';
import { IPendingPaymentTypes } from '../dto/update-pending-payment';

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
    private loggerService: LoggerService,
    private storageService: StorageService,
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

      const { customization, products } = body;

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

      const doesHaveLicense = productsList.some(
        (product) => product.does_have_license,
      );

      let customization_id: string | null = null;
      if (customization.cost) {
        const customizationData = new this.customizationModel({
          cost: customization.cost,
          modules: customization.modules,
          product_id: products[0],
        });
        await customizationData.save();
        customization_id = customizationData._id as string;

        this.loggerService.log(
          JSON.stringify({
            message: 'createOrder: Created customization',
            customization_id,
          }),
        );
      }

      const orderPayload = {
        ...body,
        client_id: clientId,
        purchase_date: new Date(body.purchased_date),
      };

      delete orderPayload.customization;

      if (doesHaveLicense) {
        orderPayload['is_purchased_with_order.license'] = true;
      }

      if (customization_id) {
        orderPayload['customizations'] = [customization_id];
        orderPayload['is_purchased_with_order.customization'] = true;
      }

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

      const amcTotalCost = (customization.cost || 0) + order.base_cost;

      const amcAmount = (amcTotalCost / 100) * amcPercentage;

      this.loggerService.log(
        JSON.stringify({
          message: 'createOrder: Creating AMC',
          amcTotalCost,
          amcAmount,
          amcPercentage,
        }),
      );

      const till_date_of_payment = this.getNextDate(body.amc_start_date, 12);
      const payments = body.amc_start_date
        ? [
            {
              from_date: body.amc_start_date,
              to_date: till_date_of_payment,
              status: PAYMENT_STATUS_ENUM.PAID,
              received_date: body.amc_start_date,
            },
          ]
        : [];

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
        payments,
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

      if (customization_id) {
        await this.customizationModel.findByIdAndUpdate(customization_id, {
          order_id: order._id,
        });
      }

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

      const { customization, products } = body;

      const productsList = await this.productModel.find({
        _id: { $in: products },
      });

      if (productsList.length !== products.length) {
        throw new Error('Invalid product id');
      }

      let customization_id: string | null =
        existingOrder.customizations?.[0]?.toString() || null;
      let isNewCustomization = false;
      if (customization.cost || customization?.modules?.length) {
        const customizationUpdate = {
          cost: customization.cost,
          modules: customization.modules,
          product_id: products[0],
        };

        if (customization_id) {
          await this.customizationModel.findByIdAndUpdate(
            customization_id,
            customizationUpdate,
          );
        } else {
          isNewCustomization = true;
          const customizationData = new this.customizationModel(
            customizationUpdate,
          );
          await customizationData.save();
          customization_id = customizationData._id.toString();
        }
      }

      const orderPayload = {
        ...body,
        customizations: isNewCustomization
          ? [customization_id]
          : existingOrder.customizations,
      };

      if (isNewCustomization) {
        orderPayload['is_purchased_with_order.customization'] = true;
      }

      delete orderPayload.customization;

      if (orderPayload.payment_terms.length) {
        orderPayload.payment_terms.map((term) => {
          term.invoice_document = extractS3Key(term.invoice_document);
          return term;
        });
      }

      orderPayload.purchase_order_document = extractS3Key(
        orderPayload.purchase_order_document,
      );

      if (orderPayload.other_documents.length) {
        orderPayload.other_documents = orderPayload.other_documents.map(
          (doc) => {
            doc.url = extractS3Key(doc.url);
            return doc;
          },
        );
      }

      orderPayload.agreements.map((agreement) => {
        agreement.document = extractS3Key(agreement.document);
        return agreement;
      });

      const updatedOrder = await this.orderModel.findByIdAndUpdate(
        orderId,
        orderPayload,
        { new: true },
      );

      const amcTotalCost =
        (customization?.cost || 0) + (updatedOrder.base_cost || 0);
      let amcPercentage = updatedOrder.amc_rate?.percentage || 0;

      const amcAmount = (amcTotalCost / 100) * amcPercentage;

      if (updatedOrder.amc_id) {
        const DEFAULT_AMC_CYCLE_IN_MONTHS = 12;
        const till_date_of_payment = this.getNextDate(
          body.amc_start_date,
          DEFAULT_AMC_CYCLE_IN_MONTHS,
        );

        const amc = await this.amcModel.findById(updatedOrder.amc_id);

        const payments =
          !amc?.payments?.length && body.amc_start_date
            ? [
                {
                  from_date: body.amc_start_date,
                  to_date: till_date_of_payment,
                  status: PAYMENT_STATUS_ENUM.PAID,
                },
              ]
            : amc?.payments || [];

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

    // update all orders agreemtent_date to be an array i.e documents which has agreements.start and agreements.end move that object into an array
    const orders = await this.orderModel.find();
    for (const order of orders) {
      if (order.agreements && !Array.isArray(order.agreements)) {
        order.agreements = [order.agreements];
        await order.save();
      }
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
        .populate([{ path: 'customizations', model: Customization.name }]);

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

      if (orderObj.customizations && orderObj.customizations.length > 0) {
        orderObj['customization'] = orderObj.customizations[0];
        delete orderObj.customizations;
      }

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

      return orderObj;
    } catch (error: any) {
      console.log({ error });
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

  async loadAllOrdersWithAttributes(page: number, limit: number) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getAllOrdersWithFilters: Fetching all orders',
        }),
      );

      const orders = await this.orderModel
        .find()
        .sort({ _id: -1 })
        .populate<{
          client_id: ClientDocument;
        }>([
          { path: 'licenses', model: License.name },
          { path: 'customizations', model: Customization.name },
          { path: 'additional_services', model: AdditionalService.name },
          { path: 'products', model: Product.name },
          { path: 'client_id', model: Client.name },
        ]);

      const productsList = await this.productModel.find();

      let customizations = [],
        licenses = [],
        additional_services = [];

      const ordersList = orders.map((order) => {
        const orderObj = order.toObject() as any;

        if (
          orderObj.is_purchased_with_order?.license &&
          orderObj.licenses?.length
        ) {
          orderObj.license = orderObj.licenses[0];
          orderObj.licenses.forEach(
            (license) => (license.status = order.status),
          );
          licenses.push(...orderObj.licenses);
          delete orderObj.licenses;
        }

        if (
          orderObj.is_purchased_with_order?.customization &&
          orderObj.customizations?.length
        ) {
          orderObj.customization = orderObj.customizations[0];
          orderObj.customizations.forEach(
            (customization) => (customization.status = order.status),
          );
          customizations.push(...orderObj.customizations);
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

        if (orderObj.additional_services?.length) {
          orderObj.additional_services.forEach(
            (service) => (service.status = order.status),
          );
          additional_services.push(...orderObj.additional_services);
          delete orderObj.additional_services;
        }

        return orderObj;
      });

      const purchases = [
        ...ordersList.map((order: OrderDocument) => ({
          client: order.client_id || { name: 'Unknown' },
          purchase_type: PURCHASE_TYPE.ORDER,
          products: order.products,
          status: order.status,
          amc_start_date: order?.amc_start_date || null,
          id: order._id,
        })),
        ...licenses.map((license) => ({
          client: orders.find(
            (o) => o._id.toString() === license.order_id?.toString(),
          )?.client_id || { name: 'Unknown' },
          purchase_type: PURCHASE_TYPE.LICENSE,
          products: [
            productsList.find(
              (p) => p._id.toString() === license.product_id?.toString(),
            ) || null,
          ],
          status: license.status,
          id: license._id,
        })),
        ...customizations.map((customization) => ({
          client: orders.find(
            (o) => o._id.toString() === customization.order_id?.toString(),
          )?.client_id || { name: 'Unknown' },
          purchase_type: PURCHASE_TYPE.CUSTOMIZATION,
          products: [
            productsList.find(
              (p) => p._id.toString() === customization.product_id?.toString(),
            ) || null,
          ],
          status: customization.status,
          id: customization._id,
        })),
        ...additional_services.map((service) => ({
          client: orders.find(
            (o) => o._id.toString() === service.order_id?.toString(),
          )?.client_id || { name: 'Unknown' },
          purchase_type: PURCHASE_TYPE.ADDITIONAL_SERVICE,
          products: [{ name: service.name || '' }],
          status: service.status,
          id: service._id,
        })),
      ];

      return { purchases };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getAllOrdersWithFilters: Error fetching orders',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
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

      if (!amc) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getAmcByOrderId: AMC not found',
            orderId,
          }),
        );
        throw new HttpException('AMC not found', HttpStatus.NOT_FOUND);
      }

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

  async updateAMC(orderId: string, body: UpdateAMCDto) {
    if (!orderId) {
      this.loggerService.error(
        JSON.stringify({
          message: 'updateAMC: Order id is required',
        }),
      );
      throw new HttpException('Order id is required', HttpStatus.BAD_REQUEST);
    }

    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'updateAMC: Updating AMC',
          orderId,
          body,
        }),
      );

      const amc = await this.amcModel.findOne({ order_id: orderId }).populate({
        path: 'client_id',
        model: Client.name,
      });

      const amc_frequency_in_months = (amc.client_id as any)
        .amc_frequency_in_months;

      if (!amc) {
        this.loggerService.error(
          JSON.stringify({
            message: 'updateAMC: AMC not found',
            orderId,
          }),
        );
        throw new HttpException('AMC not found', HttpStatus.NOT_FOUND);
      }

      const payload = {
        ...body,
        start_date: body.start_date
          ? new Date(body.start_date)
          : amc.start_date,
      };

      // // Merge changes from body.payments to amc.payments
      // if (body.payments) {
      //   payload.payments = amc.payments.map((payment: any) => {
      //     const updatedPayment = body.payments.find(
      //       (p: any) => p._id.toString() === payment._id.toString(),
      //     );
      //     return updatedPayment || payment;
      //   });
      // }

      // Handle payments update for date/frequency changes
      if (body.start_date !== amc.start_date.toString()) {
        this.loggerService.log(
          JSON.stringify({
            message: 'updateAMC: Start date has changed',
            previousStartDate: amc.start_date,
            newStartDate: body.start_date,
          }),
        );

        const payments = [...payload.payments];
        const lastPayment = payments[payments.length - 1];
        const secondLastPayment = payments[payments.length - 2];

        // Only update if last payment is pending
        if (lastPayment && lastPayment.status === PAYMENT_STATUS_ENUM.PENDING) {
          this.loggerService.log(
            JSON.stringify({
              message:
                'updateAMC: Last payment is pending, updating payment dates',
              lastPayment,
              secondLastPayment,
            }),
          );

          const frequency =
            amc_frequency_in_months || DEFAULT_AMC_CYCLE_IN_MONTHS;

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
              : payload.start_date;
            this.loggerService.log(
              JSON.stringify({
                message:
                  'updateAMC: No second last payment found, using last paid payment or start_date',
                fromDate,
              }),
            );
          }

          lastPayment.from_date = fromDate;
          lastPayment.to_date = this.getNextDate(new Date(fromDate), frequency);
          this.loggerService.log(
            JSON.stringify({
              message: 'updateAMC: Updated last payment dates',
              lastPayment,
            }),
          );
        }

        payload.payments = payments;
      }

      const updatedAMC = await this.amcModel.findByIdAndUpdate(
        amc._id,
        {
          $set: payload,
        },
        {
          new: true,
        },
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'updateAMC: AMC updated successfully',
          orderId,
        }),
      );

      return updatedAMC;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'updateAMC: Error updating AMC',
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
    filter: AMC_FILTER,
    options: { upcoming: number } = { upcoming: 1 },
  ) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'loadAllAMC: Fetching all AMC',
        }),
      );
      let findFilter = {};

      switch (filter) {
        case AMC_FILTER.ALL:
          findFilter = {};
          break;
        case AMC_FILTER.UPCOMING:
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          findFilter = {
            'payments.from_date': {
              $gte: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 2),
              $lte: new Date(
                nextMonth.getFullYear(),
                nextMonth.getMonth() + options.upcoming,
                0,
              ),
            },
            'payments.status': PAYMENT_STATUS_ENUM.PENDING,
          };
          break;
        case AMC_FILTER.PAID:
          findFilter = {
            $expr: {
              $eq: [
                { $arrayElemAt: ['$payments.status', -1] },
                PAYMENT_STATUS_ENUM.PAID,
              ],
            },
          };
          break;
        case AMC_FILTER.PENDING:
          findFilter = {
            $expr: {
              $eq: [
                { $arrayElemAt: ['$payments.status', -1] },
                PAYMENT_STATUS_ENUM.PENDING,
              ],
            },
          };
          break;
        case AMC_FILTER.OVERDUE:
          findFilter = {
            $expr: {
              $and: [
                {
                  $lt: [
                    { $arrayElemAt: ['$payments.to_date', -1] },
                    new Date(),
                  ],
                },
                {
                  $eq: [
                    { $arrayElemAt: ['$payments.status', -1] },
                    PAYMENT_STATUS_ENUM.PENDING,
                  ],
                },
              ],
            },
          };
          break;
      }

      const amcs = await this.amcModel
        .find(findFilter)
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
          message: 'loadAllAMC: AMC fetched successfully',
        }),
      );

      const amcsList = [];
      for (const amc of amcs) {
        const amcObj = amc.toObject();

        if (amc.payments.length <= 1 && filter !== AMC_FILTER.FIRST)
          continue; // this means that the AMC is still free
        else if (amc.payments.length > 1 && filter === AMC_FILTER.FIRST)
          continue;

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
      }

      return amcsList;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'loadAllAMC: Error fetching AMC',
          error: error.message,
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

      // Find only AMCs that have payments
      const amcs = await this.amcModel
        .find({
          payments: { $exists: true, $ne: [] },
        })
        .populate({
          path: 'client_id',
          select: 'amc_frequency_in_months',
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

      const updates = amcs.map(async (amc) => {
        try {
          const amc_frequency_in_months =
            (amc.client_id as any)?.amc_frequency_in_months ||
            DEFAULT_AMC_CYCLE_IN_MONTHS;

          const { payments, _id } = amc;
          const lastPayment = payments[payments.length - 1];

          this.loggerService.log(
            JSON.stringify({
              message: 'updateAMCPayments: Processing AMC',
              amcId: _id,
              lastPaymentDate: lastPayment.to_date,
              frequency: amc_frequency_in_months,
            }),
          );

          if (today > new Date(lastPayment.to_date)) {
            const newPayment = {
              from_date: lastPayment.to_date,
              to_date: this.getNextDate(
                lastPayment.to_date,
                amc_frequency_in_months,
              ),
              status: PAYMENT_STATUS_ENUM.PENDING,
              purchase_order_document: '',
              invoice_document: '',
              received_date: undefined,
            };

            await this.amcModel.findByIdAndUpdate(_id, {
              $push: { payments: newPayment },
            });

            this.loggerService.log(
              JSON.stringify({
                message: 'updateAMCPayments: Added new payment',
                amcId: _id,
                newPayment,
              }),
            );

            updatedPaymentsCount++;
          } else {
            skippedCount++;
            this.loggerService.log(
              JSON.stringify({
                message: 'updateAMCPayments: Skipped AMC - payment not due',
                amcId: _id,
              }),
            );
          }
        } catch (error: any) {
          errorCount++;
          this.loggerService.error(
            JSON.stringify({
              message: 'updateAMCPayments: Error processing individual AMC',
              amcId: amc._id,
              error: error.message,
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
            completionTime: new Date().toISOString(),
          },
        }),
      );

      return {
        processed: amcs.length,
        updated: updatedPaymentsCount,
        skipped: skippedCount,
        errors: errorCount,
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

  async getAllPendingPayments(page: number = 1, limit: number = 20) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getAllPendingPayments: Starting to fetch pending payments',
        }),
      );

      const TOTAL_PURCHASES_SCENARIOS = 5;
      const pendingLimitForEachSchema = limit / TOTAL_PURCHASES_SCENARIOS;

      // Get total counts first
      const [
        totalAMCs,
        totalLicenses,
        totalCustomizations,
        totalServices,
        totalOrders,
      ] = await Promise.all([
        this.amcModel.countDocuments({
          'payments.1': { $exists: true },
          'payments.status': PAYMENT_STATUS_ENUM.PENDING,
        }),
        this.licenseModel.countDocuments({
          payment_status: PAYMENT_STATUS_ENUM.PENDING,
        }),
        this.customizationModel.countDocuments({
          payment_status: PAYMENT_STATUS_ENUM.PENDING,
        }),
        this.additionalServiceModel.countDocuments({
          payment_status: PAYMENT_STATUS_ENUM.PENDING,
        }),
        this.orderModel.countDocuments({
          'payment_terms.status': PAYMENT_STATUS_ENUM.PENDING,
        }),
      ]);

      const [
        pendingAMCs,
        pendingLicenses,
        pendingCustomizations,
        pendingServices,
        pendingOrders,
      ] = await Promise.all([
        this.amcModel
          .find({
            'payments.1': { $exists: true },
            'payments.status': PAYMENT_STATUS_ENUM.PENDING,
          })
          .populate('client_id', 'name')
          .populate('products', 'name')
          .skip((page - 1) * pendingLimitForEachSchema)
          .limit(pendingLimitForEachSchema),
        this.licenseModel
          .find({ payment_status: PAYMENT_STATUS_ENUM.PENDING })
          .populate('order_id')
          .populate({
            path: 'product_id',
            select: 'name',
          })
          .skip((page - 1) * pendingLimitForEachSchema)
          .limit(pendingLimitForEachSchema),
        this.customizationModel
          .find({
            payment_status: PAYMENT_STATUS_ENUM.PENDING,
          })
          .populate('order_id')
          .populate('product_id', 'name')
          .skip((page - 1) * pendingLimitForEachSchema)
          .limit(pendingLimitForEachSchema),
        this.additionalServiceModel
          .find({
            payment_status: PAYMENT_STATUS_ENUM.PENDING,
          })
          .populate('order_id')
          .skip((page - 1) * pendingLimitForEachSchema)
          .limit(pendingLimitForEachSchema),
        this.orderModel
          .find({
            'payment_terms.status': PAYMENT_STATUS_ENUM.PENDING,
          })
          .populate('client_id', 'name')
          .populate('products', 'name')
          .skip((page - 1) * pendingLimitForEachSchema)
          .limit(pendingLimitForEachSchema),
      ]);

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

      // AMCs
      for (const amc of pendingAMCs) {
        if (Array.isArray(amc.payments)) {
          amc.payments.forEach((payment, index) => {
            if (payment.status === PAYMENT_STATUS_ENUM.PENDING) {
              pendingPayments.push({
                _id: amc._id.toString(),
                type: 'amc',
                status: PAYMENT_STATUS_ENUM.PENDING,
                pending_amount: amc.amount || 0,
                payment_identifier: index,
                payment_date: payment.from_date,
                name: `AMC no ${index + 1}`,
                client_name: (amc.client_id as any)?.name || 'N/A',
                product_name:
                  (amc.products as any[])?.map((p) => p.name).join(', ') ||
                  'N/A',
              });
            }
          });
        }
      }

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
          name: (license?.product_id as unknown as ProductDocument)?.name ?? '',
          client_name: order?.client_id?.name || 'N/A',
          product_name:
            (license?.product_id as unknown as ProductDocument)?.name ?? 'N/A',
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
            (customization?.product_id as unknown as ProductDocument)?.name ??
            'N/A',
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
          product_name: service.name || 'N/A',
        });
      }

      // Orders
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
                payment_identifier: index,
                payment_date: term.payment_receive_date,
                name: term.name,
                client_name: (order.client_id as any)?.name || 'N/A',
                product_name:
                  (order.products as any[])?.map((p) => p.name).join(', ') ||
                  'N/A',
              });
            }
          });
        }
      }

      const totalCount =
        totalAMCs +
        totalLicenses +
        totalCustomizations +
        totalServices +
        totalOrders;
      const totalPages = Math.ceil(totalCount / limit);

      this.loggerService.log(
        JSON.stringify({
          message:
            'getAllPendingPayments: Successfully fetched all pending payments',
          total: pendingPayments.length,
        }),
      );

      return {
        pending_payments: pendingPayments,
        pagination: {
          total: totalCount,
          currentPage: page,
          totalPages,
          limit,
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
}
