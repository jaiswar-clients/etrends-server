import {
  Customization,
  CustomizationDocument,
} from '@/db/schema/order/customization.schema';
import { License, LicenseDocument } from '@/db/schema/order/license.schema';
import { Order, OrderDocument } from '@/db/schema/order/product-order.schema';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { CreateOrderDto } from '../dto/create-first-order.dto';
import { Product, ProductDocument } from '@/db/schema/product.schema';
import { LoggerService } from '@/common/logger/services/logger.service';
import { Client, ClientDocument } from '@/db/schema/client.schema';
import { StorageService } from '@/common/storage/services/storage.service';
import { CreateNewOrderDto } from '../dto/create-order.dto';

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
    private loggerService: LoggerService,
    private storageService: StorageService,
  ) {}

  async createFirstOrder(clientId: string, body: CreateOrderDto) {
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
      if (customization.amc_rate || customization.modules.length) {
        const customizationData = new this.customizationModel({
          cost: customization.cost,
          amc_rate: customization.amc_rate,
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
      };
      // remove the license_details and customization from the body
      delete orderPayload.license_details;
      delete orderPayload.customization;

      if (license_id) {
        orderPayload['license_id'] = license_id;
      }
      if (customization_id) {
        orderPayload['customization_id'] = customization_id;
      }

      const order = new this.orderModel(orderPayload);
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
          $cond: {
            if: { $gt: [{ $size: '$orders' }, 0] },
            then: { $set: { 'orders.0': order._id } },
            else: { $push: { orders: order._id } },
          },
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
  async updateFirstOrder(orderId: string, body: CreateOrderDto) {
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
        existingOrder.license_id?.toString() || null;
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
        existingOrder.customization_id?.toString() || null;
      if (customization?.amc_rate || customization?.modules?.length) {
        const customizationUpdate = {
          cost: customization.cost,
          amc_rate: customization.amc_rate,
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

  async getFirstOrder(clientId: string) {
    try {
      if (!clientId) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getFirstOrder: Client id is required',
          }),
        );
        throw new HttpException(
          'Client id is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'getFirstOrder: Fetching client',
          clientId,
        }),
      );

      const client = await this.clientModel.findById(clientId).populate({
        path: 'orders',
        populate: [
          { path: 'license_id', model: License.name },
          { path: 'customization_id', model: Customization.name },
        ],
        options: { limit: 1 },
      });

      if (!client) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getFirstOrder: Client not found',
            clientId,
          }),
        );
        throw new HttpException('Client not found', HttpStatus.NOT_FOUND);
      }

      if (!client.orders || client.orders.length === 0) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getFirstOrder: No orders found for client',
            clientId,
          }),
        );
        throw new HttpException('No orders found', HttpStatus.NOT_FOUND);
      }

      const order = await this.orderModel.findById(client.orders[0]).populate([
        { path: 'license_id', model: License.name },
        { path: 'customization_id', model: Customization.name },
      ]);

      // transform the order.license_id and order.customization_id to order.license and order.customization and delete the original fields
      const orderObj = order.toObject();
      if (orderObj.license_id) {
        orderObj['license'] = orderObj.license_id;
        delete orderObj.license_id;
      }

      if (orderObj.customization_id) {
        orderObj['customization'] = orderObj.customization_id;
        delete orderObj.customization_id;
      }

      if (!order) {
        this.loggerService.error(
          JSON.stringify({
            message: 'getFirstOrder: Order not found',
            orderId: client.orders[0],
          }),
        );
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'getFirstOrder: Order found successfully',
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
          message: 'getFirstOrder: Error fetching order',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  //  For Creating new Orders

  async createNewOrder(clientId: string, body: CreateNewOrderDto) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'createNewOrder: Creating new order',
          body,
        }),
      );

      const { license_details, products } = body;

      const productsList = await this.productModel.find({
        _id: { $in: products },
      });

      this.loggerService.log(
        JSON.stringify({
          message: 'createNewOrder: Found products',
          productsList,
        }),
      );

      if (productsList.length !== products.length) {
        throw new Error('Invalid product id');
      }

      let license_id: string | null = null;
      const doesHaveLicense = productsList.some(
        (product) => product.does_have_license,
      );

      if (
        doesHaveLicense &&
        !license_details?.cost_per_license &&
        !license_details?.total_license
      ) {
        throw new Error('License is required');
      } else if (
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
            message: 'createNewOrder: Created license',
            license_id,
          }),
        );
      }

      const orderPayload = {
        ...body,
      };
      delete orderPayload.license_details;

      if (license_id) {
        orderPayload['license_id'] = license_id;
      }

      const order = new this.orderModel(orderPayload);
      await order.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'createNewOrder: Order created successfully',
          order_id: order._id,
        }),
      );

      // Add new Order in client
      await this.clientModel.findOneAndUpdate(
        { _id: clientId },
        {
          $push: { orders: order._id },
        },
      );

      return order;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'createNewOrder: Error creating order',
          error: error.message,
        }),
      );
      throw new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
