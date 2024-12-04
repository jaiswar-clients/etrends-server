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
import { PURCHASE_TYPE } from '@/common/types/enums/order.enum';
import { AMC, AMCDocument } from '@/db/schema/amc/amc.schema';
import { Types } from 'mongoose';
import { UpdateAMCDto } from '../dto/update-amc.dto';

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
          body,
        }),
      );

      const { license_details, customization, products } = body;

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

      let license_id: string | null = null;
      // check if the products list have the does_have_license flag
      const doesHaveLicense = productsList.some(
        (product) => product.does_have_license,
      );

      if (
        doesHaveLicense &&
        !license_details.cost_per_license &&
        !license_details.total_license
      ) {
        throw new Error('License is required');
      } else if (
        doesHaveLicense &&
        license_details.cost_per_license &&
        license_details.total_license
      ) {
        // find the correct product id of the license to be purchased
        const licenseProduct = productsList.find(
          (product) => product.does_have_license,
        );
        if (!licenseProduct) {
          throw new Error('License product not found');
        }

        const license = new this.licenseModel({
          rate: {
            amount: license_details.cost_per_license,
            percentage: 0,
          },
          total_license: license_details.total_license,
          product_id: licenseProduct._id,
        });
        await license.save();
        license_id = license._id as string;

        this.loggerService.log(
          JSON.stringify({
            message: 'createOrder: Created license',
            license_id,
          }),
        );
      }

      let customization_id: string | null = null;
      if (customization.modules.length) {
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
      // remove the license_details and customization from the body
      delete orderPayload.license_details;
      delete orderPayload.customization;

      if (license_id) {
        orderPayload['licenses'] = [license_id];
        orderPayload['is_purchased_with_order.license'] = true;
      }
      if (customization_id) {
        orderPayload['customizations'] = [customization_id];
        orderPayload['is_purchased_with_order.customization'] = true;
      }

      const order = new this.orderModel(orderPayload);

      // AMC Creation
      const amcTotalCost = (customization.cost || 0) + order.base_cost;

      // calculate amc_percentage if order.amc_rate.amount is present
      let amcPercentage = order.amc_rate.percentage;

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
        start_date: new Date(body.amc_start_date),
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

      // if customization_id and license_id, update its object with orderId
      if (license_id) {
        await this.licenseModel.findByIdAndUpdate(license_id, {
          order_id: order._id,
        });
      }
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
      const existingOrder = await this.orderModel.findById(orderId);
      if (!existingOrder) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      const { license_details, customization, products } = body;

      const productsList = await this.productModel.find({
        _id: { $in: products },
      });

      if (productsList.length !== products.length) {
        throw new Error('Invalid product id');
      }

      let license_id: string | null =
        existingOrder.licenses[0]?.toString() || null;
      const doesHaveLicense = productsList.some(
        (product) => product.does_have_license,
      );

      if (
        doesHaveLicense &&
        license_details?.cost_per_license &&
        license_details?.total_license
      ) {
        const licenseProduct = productsList.find(
          (product) => product.does_have_license,
        );
        if (!licenseProduct) {
          throw new Error('License product not found');
        }

        const licenseUpdate = {
          rate: {
            amount: license_details.cost_per_license,
            percentage: 0,
          },
          total_license: license_details.total_license,
          product_id: licenseProduct._id,
        };

        if (license_id) {
          await this.licenseModel.findByIdAndUpdate(license_id, licenseUpdate);
        } else {
          const license = await this.licenseModel.create(licenseUpdate);
          license_id = license._id.toString();
        }
      }

      let customization_id: string | null =
        existingOrder.customizations[0]?.toString() || null;
      if (customization?.modules?.length) {
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
          const customizationData =
            await this.customizationModel.create(customizationUpdate);
          customization_id = customizationData._id.toString();
        }
      }

      const orderPayload = {
        ...body,
        license_id,
        customization_id,
      };
      delete orderPayload.license_details;
      delete orderPayload.customization;

      const updatedOrder = await this.orderModel.findByIdAndUpdate(
        orderId,
        orderPayload,
        { new: true },
      );

      const amcTotalCost = (customization.cost || 0) + updatedOrder.base_cost;
      let amcPercentage = updatedOrder.amc_rate.percentage;

      const amcAmount = (amcTotalCost / 100) * amcPercentage;

      await this.amcModel.findByIdAndUpdate(updatedOrder.amc_id, {
        total_cost: amcTotalCost,
        amount: amcAmount,
        products: products,
        amc_percentage: amcPercentage,
        start_date: new Date(body.amc_start_date),
      });

      this.loggerService.log(
        JSON.stringify({
          message: 'updateFirstOrder: Order updated successfully',
          order_id: updatedOrder._id,
        }),
      );

      return updatedOrder;
    } catch (error: any) {
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

      const order = await this.orderModel.findById(orderId).populate([
        { path: 'licenses', model: License.name },
        { path: 'customizations', model: Customization.name },
      ]);

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
      if (orderObj.licenses && orderObj.licenses.length > 0) {
        orderObj['license'] = orderObj.licenses[0];
        delete orderObj.licenses;
      }

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
      if (orderObj.agreement_document) {
        orderObj.agreement_document = this.storageService.get(
          orderObj.agreement_document,
        );
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
        if (orderObj.agreement_document) {
          orderObj.agreement_document = this.storageService.get(
            orderObj.agreement_document,
          );
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
        invoice: body.invoice,
      });
      await license.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'createLicense: License created successfully',
          license_id: license._id,
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
        if (orderObj.agreement_document) {
          orderObj.agreement_document = this.storageService.get(
            orderObj.agreement_document,
          );
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
        ...ordersList.map((order) => ({
          client: order.client_id || { name: 'Unknown' },
          purchase_type: PURCHASE_TYPE.ORDER,
          products: order.products,
          status: order.status,
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
      if (amc.purchase_order_document) {
        amcObject.purchase_order_document = this.storageService.get(
          amcObject.purchase_order_document,
        );
      } else if (amc.invoice_document) {
        amcObject.invoice_document = this.storageService.get(
          amcObject.invoice_document,
        );
      }

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

      const amc = await this.amcModel.findOne({ order_id: orderId });
      if (!amc) {
        this.loggerService.error(
          JSON.stringify({
            message: 'updateAMC: AMC not found',
            orderId,
          }),
        );
        throw new HttpException('AMC not found', HttpStatus.NOT_FOUND);
      }

      const updatedAMC = await this.amcModel.findByIdAndUpdate(
        amc._id,
        {
          $set: {
            purchase_order_number: body.purchase_order_number,
            amc_frequency_in_months: body.amc_frequency_in_months,
            purchase_order_document: body.purchase_order_document,
            invoice_document: body.invoice_document,
            start_date: body.start_date,
          },
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
            invoice: body.invoice,
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

  async loadAllAMC(page: number, limit: number) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'loadAllAMC: Fetching all AMC',
        }),
      );

      const amcs = await this.amcModel
        .find()
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

      const amcsList = amcs.map((amc) => {
        const amcObj = amc.toObject();
        if (amcObj.purchase_order_document) {
          amcObj.purchase_order_document = this.storageService.get(
            amcObj.purchase_order_document,
          );
        } else if (amcObj.invoice_document) {
          amcObj.invoice_document = this.storageService.get(
            amcObj.invoice_document,
          );
        }
        amcObj['client'] = amcObj.client_id;
        delete amcObj.client_id;
        amcObj['order'] = amcObj.order_id;
        // amcObj['products'] = amcObj.order_id ;
        delete amcObj.order_id;
        return amcObj;
      });

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
}
