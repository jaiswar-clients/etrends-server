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
import { CheckDuplicateDto } from '../dto/check-duplicate.dto';
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
  types?: string;
  includeCancelled?: boolean;
  paymentStatus?: PAYMENT_STATUS_ENUM;
  amcPending?: boolean;
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

  async checkDuplicates(body: CheckDuplicateDto) {
    this.loggerService.log(
      JSON.stringify({
        message: 'checkDuplicates: Checking for duplicate purchases',
        data: body,
      }),
    );

    const {
      clientId,
      purchaseType,
      purchaseOrderNumber,
      invoiceNumber,
      productIds,
      productId,
    } = body;
    const clientIdObj = new Types.ObjectId(clientId);

    this.loggerService.log(
      JSON.stringify({
        message: 'checkDuplicates: Checking with values',
        clientId,
        purchaseType,
        purchaseOrderNumber,
        invoiceNumber,
        productIds,
        productId,
      }),
    );

    let duplicateRecords: Array<{
      id: string;
      type: string;
      description: string;
    }> = [];

    switch (purchaseType) {
      case 'order':
        // For Orders: Check client_id + (products array OR purchase_order_number)

        // Check 1: By productIds
        if (productIds && productIds.length > 0) {
          const productIdsObj = productIds.map((id) => new Types.ObjectId(id));

          // Find orders where any of the productIds exist in the order's products array
          const ordersWithProducts = await this.orderModel
            .find({
              client_id: { $in: [clientIdObj, clientId] },
              products: { $in: productIdsObj },
            })
            .lean();

          this.loggerService.log(
            JSON.stringify({
              message:
                'checkDuplicates: Found orders with same client and products',
              count: ordersWithProducts.length,
              productIds,
            }),
          );

          for (const order of ordersWithProducts) {
            const orderProducts = (order as any).products || [];

            const allProductsMatch = productIds.every((pid) =>
              orderProducts.some((op: any) => op.toString() === pid),
            );
            const productsOverlap = productIds.some((pid) =>
              orderProducts.some((op: any) => op.toString() === pid),
            );

            if (allProductsMatch || productsOverlap) {
              duplicateRecords.push({
                id: order._id.toString(),
                type: 'order',
                description: `Order with same products already exists (existing order has ${orderProducts.length} products: [${orderProducts.map((op: any) => op.toString()).join(', ')}])`,
              });
            }
          }
        }

        // Check 2: By purchaseOrderNumber
        if (purchaseOrderNumber) {
          const clientIdMixed = [clientIdObj, clientId];

          const ordersWithPO = await this.orderModel
            .find({
              client_id: { $in: clientIdMixed },
              purchase_order_number: purchaseOrderNumber,
            })
            .lean();

          this.loggerService.log(
            JSON.stringify({
              message:
                'checkDuplicates: Found orders with same client and PO number',
              count: ordersWithPO.length,
              purchaseOrderNumber,
            }),
          );

          for (const order of ordersWithPO) {
            const orderProducts = (order as any).products || [];

            duplicateRecords.push({
              id: order._id.toString(),
              type: 'order',
              description: `Order with PO number "${purchaseOrderNumber}" already exists (existing order has ${orderProducts.length} products: [${orderProducts.map((op: any) => op.toString()).join(', ')}])`,
            });
          }
        }

        this.loggerService.log(
          JSON.stringify({
            message: 'checkDuplicates: Order duplicate check complete',
            duplicateRecords,
          }),
        );
        break;

      case 'license':
        // For Licenses: Check client_id + product_id + purchase_order_number
        if (purchaseOrderNumber && productId) {
          const duplicateLicenses = await this.licenseModel
            .find({
              client_id: clientIdObj,
              product_id: productId,
              purchase_order_number: purchaseOrderNumber,
            })
            .lean();

          this.loggerService.log(
            JSON.stringify({
              message:
                'checkDuplicates: Found licenses with same client, product, and PO',
              count: duplicateLicenses.length,
              search: { clientId, productId, purchaseOrderNumber },
            }),
          );

          for (const license of duplicateLicenses) {
            // Check if product_id matches exactly
            if (
              license.product_id &&
              license.product_id.toString() === productId
            ) {
              duplicateRecords.push({
                id: license._id.toString(),
                type: 'license',
                description: `License with PO number "${purchaseOrderNumber}" for same product already exists`,
              });
            }
          }
        }
        break;

      case 'customization':
        // For Customizations: Check client_id + product_id + purchase_order_number + invoice_number
        if (purchaseOrderNumber && productId && invoiceNumber) {
          const duplicateCustomizations = await this.customizationModel
            .find({
              client_id: clientIdObj,
              product_id: productId,
              purchase_order_number: purchaseOrderNumber,
              invoice_number: invoiceNumber,
            })
            .lean();

          this.loggerService.log(
            JSON.stringify({
              message:
                'checkDuplicates: Found customizations with same client, product, PO, and invoice',
              count: duplicateCustomizations.length,
              search: {
                clientId,
                productId,
                purchaseOrderNumber,
                invoiceNumber,
              },
            }),
          );

          for (const customization of duplicateCustomizations) {
            // Check if product_id, purchase_order_number, and invoice_number all match exactly
            const productMatch =
              customization.product_id &&
              customization.product_id.toString() === productId;
            const poMatch =
              customization.purchase_order_number === purchaseOrderNumber;
            const invoiceMatch = customization.invoice_number === invoiceNumber;

            if (productMatch && poMatch && invoiceMatch) {
              duplicateRecords.push({
                id: customization._id.toString(),
                type: 'customization',
                description: `Customization with PO number "${purchaseOrderNumber}" and invoice number "${invoiceNumber}" for same product already exists`,
              });
            }
          }
        }
        break;

      case 'additional-service':
        // For Additional Services: Check client_id + product_id + purchase_order_number + invoice_number
        if (purchaseOrderNumber && productId && invoiceNumber) {
          const duplicateServices = await this.additionalServiceModel
            .find({
              client_id: clientIdObj,
              product_id: productId,
              purchase_order_number: purchaseOrderNumber,
              invoice_number: invoiceNumber,
            })
            .lean();

          this.loggerService.log(
            JSON.stringify({
              message:
                'checkDuplicates: Found additional services with same client, product, PO, and invoice',
              count: duplicateServices.length,
              search: {
                clientId,
                productId,
                purchaseOrderNumber,
                invoiceNumber,
              },
            }),
          );

          for (const service of duplicateServices) {
            // Check if product_id, purchase_order_number, and invoice_number all match exactly
            const productMatch =
              service.product_id && service.product_id.toString() === productId;
            const poMatch =
              service.purchase_order_number === purchaseOrderNumber;
            const invoiceMatch = service.invoice_number === invoiceNumber;

            if (productMatch && poMatch && invoiceMatch) {
              duplicateRecords.push({
                id: service._id.toString(),
                type: 'additional-service',
                description: `Additional service with PO number "${purchaseOrderNumber}" and invoice number "${invoiceNumber}" for same product already exists`,
              });
            }
          }
        }
        break;

      default:
        this.loggerService.error(
          JSON.stringify({
            message: 'checkDuplicates: Invalid purchase type',
            purchaseType,
          }),
        );
        break;
    }

    return {
      hasDuplicate: duplicateRecords.length > 0,
      duplicateRecords,
    };
  }

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
        pending_balance: body.base_cost,
        total_paid: 0,
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

      if (
        body.amc_rate &&
        body.amc_rate.percentage !== existingOrder.amc_rate.percentage
      ) {
        const amc = await this.amcModel
          .findById(existingOrder.amc_id)
          .populate({
            path: 'order_id',
            model: Order.name,
            populate: [
              {
                path: 'client_id',
                model: Client.name,
                select: 'amc_frequency_in_months',
              },
            ],
          });

        if (amc) {
          const order = amc.order_id as any;
          const amc_frequency_in_months =
            order?.client_id?.amc_frequency_in_months || 12;

          const today = new Date();
          const currentCycleEndDate = new Date();
          currentCycleEndDate.setMonth(
            currentCycleEndDate.getMonth() + amc_frequency_in_months,
          );

          // Find payments that start after the current cycle ends
          const nextCyclePaymentIndex = amc.payments.findIndex(
            (p) => new Date(p.from_date) >= currentCycleEndDate,
          );

          if (nextCyclePaymentIndex !== -1) {
            const newAmcAmount =
              (amc.total_cost / 100) * body.amc_rate.percentage;

            // Update all payments from the next cycle onwards
            for (let i = nextCyclePaymentIndex; i < amc.payments.length; i++) {
              amc.payments[i].amc_rate_applied = body.amc_rate.percentage;
              amc.payments[i].amc_rate_amount = newAmcAmount;
            }

            await this.amcModel.findByIdAndUpdate(amc._id, {
              payments: amc.payments,
            });

            this.loggerService.log(
              JSON.stringify({
                message: 'updateOrder: AMC rate updated for future cycles',
                orderId: orderId,
                oldRate: existingOrder.amc_rate.percentage,
                newRate: body.amc_rate.percentage,
                amcFrequencyInMonths: amc_frequency_in_months,
                nextCycleStartIndex: nextCyclePaymentIndex,
                updatedPaymentsCount:
                  amc.payments.length - nextCyclePaymentIndex,
              }),
            );
          }
        }
      }

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

        const newStartDateCandidate = body?.amc_start_date
          ? new Date(body.amc_start_date)
          : null;

        const hasStartDateChanged =
          !!newStartDateCandidate &&
          (!existingOrder?.amc_start_date ||
            newStartDateCandidate.getTime() !==
              new Date(existingOrder.amc_start_date).getTime());

        if (hasStartDateChanged && payments.length && newStartDateCandidate) {
          const amc_frequency_in_months =
            (amc.client_id as any)?.amc_frequency_in_months ||
            DEFAULT_AMC_CYCLE_IN_MONTHS;
          const newStartDate = new Date(newStartDateCandidate);
          const firstPendingIndex = payments.findIndex(
            (payment) => payment.status !== PAYMENT_STATUS_ENUM.PAID,
          );

          this.loggerService.log(
            JSON.stringify({
              message:
                'updateAMC: Start date has changed, recalculating pending payments',
              previousStartDate: existingOrder.amc_start_date,
              newStartDate,
              firstPendingIndex,
              totalPayments: payments.length,
              amcFrequencyInMonths: amc_frequency_in_months,
            }),
          );

          if (firstPendingIndex !== -1) {
            const recalculatedPayments = [...payments];

            let cursorDate = new Date(newStartDate);
            if (firstPendingIndex > 0) {
              cursorDate.setMonth(
                cursorDate.getMonth() +
                  amc_frequency_in_months * firstPendingIndex,
              );
            }

            for (
              let index = firstPendingIndex;
              index < recalculatedPayments.length;
              index++
            ) {
              const payment = recalculatedPayments[index];
              const normalizedFrom = new Date(cursorDate);
              const normalizedTo = this.getNextDate(
                new Date(cursorDate),
                amc_frequency_in_months,
              );

              const effectiveTotalCost =
                typeof payment.total_cost === 'number' &&
                !Number.isNaN(payment.total_cost)
                  ? payment.total_cost
                  : (amc.total_cost ?? amcTotalCost);

              const effectiveRate =
                payment.amc_rate_applied ?? amc.amc_percentage ?? amcPercentage;

              payment.from_date = normalizedFrom;
              payment.to_date = normalizedTo;
              payment.total_cost =
                effectiveTotalCost ?? amcTotalCost ?? updatedOrder.base_cost;
              payment.amc_rate_applied = effectiveRate ?? 0;
              payment.amc_rate_amount =
                ((payment.total_cost || 0) / 100) *
                (payment.amc_rate_applied || 0);

              cursorDate = normalizedTo;
            }

            payments = recalculatedPayments;
          }
        }

        const amcStartLogs =
          body?.amc_start_logs ??
          (amc?.amc_start_logs
            ? amc.amc_start_logs.map((log: any) =>
                typeof log.toObject === 'function' ? log.toObject() : log,
              )
            : []);

        await this.amcModel.findByIdAndUpdate(updatedOrder.amc_id, {
          total_cost: amcTotalCost,
          amount: amcAmount,
          products: products,
          amc_percentage: amcPercentage,
          start_date: body.amc_start_date
            ? new Date(body.amc_start_date)
            : amc?.start_date,
          payments,
          amc_start_logs: amcStartLogs,
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
        .populate({ path: 'licenses', model: License.name })
        .populate({ path: 'additional_services', model: AdditionalService.name })
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

      if (orderObj.amc_start_logs && orderObj.amc_start_logs.length) {
        orderObj.amc_start_logs = orderObj.amc_start_logs.map((log: any) => ({
          ...log,
          from: log.from ? new Date(log.from) : log.from,
          to: log.to ? new Date(log.to) : log.to,
          date: log.date ? new Date(log.date) : log.date,
          user: log.user ? log.user.toString() : log.user,
        }));
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

      const cost = cost_per_license * total_license;

      // Calculate line-item AMC rate
      const amcPercentage = body.amc_percentage ?? 0;
      const amcAmount = (cost / 100) * amcPercentage;

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
        amc_rate: {
          percentage: amcPercentage,
          amount: amcAmount,
        },
      });
      await license.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'createLicense: License created successfully',
          license_id: license._id,
        }),
      );

      // Add license AMC amount to parent AMC (do NOT recalculate percentage)
      const amc = await this.amcModel.findOne({
        order_id: new Types.ObjectId(orderId),
      });
      if (!amc) {
        throw new Error('AMC not found for this order');
      }

      const newTotalCost = amc.total_cost + cost;
      const newAmount = amc.amount + amcAmount;

      this.loggerService.log(
        JSON.stringify({
          message: 'addLicense: AMC Calc completed',
          newTotalCost,
          newAmount,
          used: { licenseAmcPercentage: amcPercentage, licenseAmcAmount: amcAmount, previousAmcAmount: amc.amount },
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
          message: 'addLicense: AMC update completed',
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

      // Calculate line-item AMC rate
      const amcPercentage = body.amc_percentage ?? 0;
      const amcAmount = (body.cost / 100) * amcPercentage;

      const additionalService = new this.additionalServiceModel({
        ...body,
        order_id: orderId,
        amc_rate: {
          percentage: amcPercentage,
          amount: amcAmount,
        },
      });
      await additionalService.save();

      this.loggerService.log(
        JSON.stringify({
          message:
            'addAdditionalService: Additional service created successfully',
          additional_service_id: additionalService._id,
        }),
      );

      // Add additional service AMC amount to parent AMC (do NOT recalculate percentage)
      const amc = await this.amcModel.findOne({
        order_id: new Types.ObjectId(orderId),
      });
      if (amc) {
        const newTotalCost = amc.total_cost + body.cost;
        const newAmount = amc.amount + amcAmount;

        await this.amcModel.findByIdAndUpdate(amc._id, {
          total_cost: newTotalCost,
          amount: newAmount,
        });

        this.loggerService.log(
          JSON.stringify({
            message: 'addAdditionalService: AMC update completed',
            newTotalCost,
            newAmount,
            used: { additionalServiceAmcPercentage: amcPercentage, additionalServiceAmcAmount: amcAmount },
          }),
        );
      }

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

      // Calculate line-item AMC rate
      const amcPercentage = body.amc_percentage ?? 0;
      const amcAmount = (cost / 100) * amcPercentage;

      const customization = new this.customizationModel({
        ...body,
        order_id: orderId,
        amc_rate: {
          percentage: amcPercentage,
          amount: amcAmount,
        },
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

      // Add customization AMC amount to parent AMC (do NOT recalculate percentage)
      const amc = await this.amcModel.findOne({
        order_id: new Types.ObjectId(orderId),
      });
      if (!amc) {
        throw new Error('AMC not found for this order');
      }

      const newTotalCost = amc.total_cost + cost;
      const newAmount = amc.amount + amcAmount;

      this.loggerService.log(
        JSON.stringify({
          message: 'addCustomization: AMC Calc completed',
          newTotalCost,
          newAmount,
          used: { customizationAmcPercentage: amcPercentage, customizationAmcAmount: amcAmount, previousAmcAmount: amc.amount },
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

  /**
   * Shared filter builder for order list and export queries.
   * Returns the constructed MongoDB filter query.
   */
  private async buildOrderFilterQuery(
    filters: OrderFilterOptions,
    context: string,
  ): Promise<{ filterQuery: any; parsedStartDate?: Date; parsedEndDate?: Date }> {
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
            message: `${context}: Invalid start date format, ignoring`,
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
            message: `${context}: Invalid end date format, ignoring`,
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
          message: `${context}: Start date is after end date, date filter will be ignored`,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
        }),
      );
      parsedStartDate = undefined;
      parsedEndDate = undefined;
    }

    const filterQuery: any = {};
    let clientIdsForFilter: Types.ObjectId[] | null = null;

    // 1. Filter by Client Name
    if (filters.clientName && filters.clientName.trim() !== '') {
      const clientsByName = await this.clientModel
        .find({
          name: { $regex: filters.clientName, $options: 'i' },
        })
        .select('_id')
        .lean<{ _id: Types.ObjectId }[]>();
      clientIdsForFilter = clientsByName.map((c) => c._id);
      if (clientIdsForFilter.length === 0) {
        filterQuery.client_id = { $in: [] };
      } else {
        filterQuery.client_id = { $in: clientIdsForFilter };
      }
    }

    // 2. Filter by Parent Company
    if (filters.parentCompanyId && filters.parentCompanyId.trim() !== '') {
      try {
        const parentCompanyObjectId = new Types.ObjectId(
          filters.parentCompanyId,
        );

        // Legacy rows store parent_company_id as strings, not ObjectIds.
        // Query the raw collection so string values are not cast away.
        const childClients = await this.clientModel.collection
          .find({
            parent_company_id: {
              $in: [parentCompanyObjectId, parentCompanyObjectId.toString()],
            },
          })
          .project({ _id: 1 })
          .toArray();

        const childClientIdStrings = new Set(
          childClients.map((c) => c._id.toString()),
        );

        if (childClientIdStrings.size === 0) {
          filterQuery.client_id = { $in: [] };
        } else if (
          filterQuery.client_id &&
          filterQuery.client_id.$in &&
          Array.isArray(filterQuery.client_id.$in)
        ) {
          const existingClientIdStrings = filterQuery.client_id.$in.map(
            (id: any) => id.toString(),
          );
          const intersectedIds = existingClientIdStrings.filter((id: string) =>
            childClientIdStrings.has(id),
          );
          clientIdsForFilter = intersectedIds.map(
            (id: string) => new Types.ObjectId(id),
          );
          filterQuery.client_id = { $in: clientIdsForFilter };
        } else {
          clientIdsForFilter = Array.from(childClientIdStrings).map(
            (id) => new Types.ObjectId(id),
          );
          filterQuery.client_id = { $in: clientIdsForFilter };
        }
      } catch (error: any) {
        this.loggerService.error(
          JSON.stringify({
            message: `${context}: Invalid parent company ID, skipping filter`,
            error: error.message,
            parentCompanyId: filters.parentCompanyId,
          }),
        );
      }
    }

    // 3. Filter by specific Client ID
    if (filters.clientId && filters.clientId.trim() !== '') {
      try {
        const specificClientId = new Types.ObjectId(filters.clientId);
        if (
          filterQuery.client_id &&
          filterQuery.client_id.$in &&
          Array.isArray(filterQuery.client_id.$in)
        ) {
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
            filterQuery.client_id = specificClientId;
          } else {
            filterQuery.client_id = { $in: [] };
          }
        } else {
          filterQuery.client_id = specificClientId;
        }
      } catch (error: any) {
        this.loggerService.error(
          JSON.stringify({
            message: `${context}: Invalid client ID, skipping filter`,
            error: error.message,
            clientId: filters.clientId,
          }),
        );
      }
    }

    // 4. Filter by Product ID or short_name
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
        // order.products is stored as strings in old rows, so query raw
        // collection to avoid Mongoose casting the filter to ObjectId.
        const ordersWithProducts = await this.orderModel.collection
          .find({ products: { $in: objectIds } })
          .project({ _id: 1 })
          .toArray();

        const productOrderIdStrings = new Set(
          ordersWithProducts.map((order) => order._id.toString()),
        );

        if (productOrderIdStrings.size === 0) {
          filterQuery._id = { $in: [] };
        } else if (
          filterQuery._id &&
          filterQuery._id.$in &&
          Array.isArray(filterQuery._id.$in)
        ) {
          const existingOrderIdStrings = filterQuery._id.$in.map((id: any) =>
            id.toString(),
          );
          const intersectedIds = existingOrderIdStrings
            .filter((id: string) => productOrderIdStrings.has(id))
            .map((id: string) => new Types.ObjectId(id));
          filterQuery._id = { $in: intersectedIds };
        } else {
          filterQuery._id = {
            $in: Array.from(productOrderIdStrings).map(
              (id) => new Types.ObjectId(id),
            ),
          };
        }
      } else {
        filterQuery._id = { $in: [] };
      }

      delete filterQuery.products;

      this.loggerService.log(
        JSON.stringify({
          message: `${context}: Product filter applied`,
          data: {
            originalProductId: filters.productId,
            identifiers,
            shortNames,
            objectIds: objectIds.map((id) => id.toString()),
            matchedOrders: filterQuery._id?.$in?.length ?? 0,
          },
        }),
      );
    }

    // 5. Filter by Status
    if (filters.status) {
      filterQuery.status = filters.status;
    }

    // 6. Filter by Types (new, amc, customization, auditor_license)
    if (filters.types && filters.types.trim() !== '') {
      const typeValues = filters.types
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      // Fetch order IDs from sub-collections when date range is provided.
      // Standalone sub-items use invoice_date (with purchase_date/purchased_date fallback)
      // and order_id is stored as a string in legacy rows.
      let licenseOrderIds: Types.ObjectId[] | null = null;
      let customizationOrderIds: Types.ObjectId[] | null = null;
      let amcOrderIds: Types.ObjectId[] | null = null;
      let additionalServiceOrderIds: Types.ObjectId[] | null = null;

      if (
        typeValues.includes('auditor_license') ||
        typeValues.includes('customization') ||
        typeValues.includes('additional_service')
      ) {
        const subItemOrderIds = await this.getOrderIdsBySubItemDateRange(
          parsedStartDate,
          parsedEndDate,
        );
        if (typeValues.includes('auditor_license')) {
          licenseOrderIds = subItemOrderIds.licenseOrderIds;
        }
        if (typeValues.includes('customization')) {
          customizationOrderIds = subItemOrderIds.customizationOrderIds;
        }
        if (typeValues.includes('additional_service')) {
          additionalServiceOrderIds = subItemOrderIds.additionalServiceOrderIds;
        }
      }

      if (typeValues.includes('amc')) {
        const subItemDateQuery = this.buildDateRangeQuery(
          parsedStartDate,
          parsedEndDate,
        );
        if (Object.keys(subItemDateQuery).length > 0) {
          const amcs = await this.amcModel
            .find({
              $or: [
                { start_date: subItemDateQuery },
                {
                  'payments.from_date': {
                    $lte: subItemDateQuery.$lte ?? new Date('2099-12-31'),
                  },
                  'payments.to_date': {
                    $gte: subItemDateQuery.$gte ?? new Date('1970-01-01'),
                  },
                },
              ],
            })
            .select('order_id')
            .lean<{ order_id: Types.ObjectId }[]>();
          amcOrderIds = [...new Set(amcs.map((a) => String(a.order_id)))]
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));
        }
      }

      const hasDateRange = !!(parsedStartDate || parsedEndDate);
      const typeConditions: any[] = [];

      if (typeValues.includes('new')) {
        const newCond: any = {
          products: { $exists: true, $ne: [] },
        };
        if (parsedStartDate && parsedEndDate) {
          newCond.purchased_date = {
            $gte: parsedStartDate,
            $lte: parsedEndDate,
          };
        } else if (parsedStartDate) {
          newCond.purchased_date = { $gte: parsedStartDate };
        } else if (parsedEndDate) {
          newCond.purchased_date = { $lte: parsedEndDate };
        }
        typeConditions.push(newCond);
      }
      if (typeValues.includes('amc')) {
        if (hasDateRange && amcOrderIds) {
          typeConditions.push({
            _id: { $in: amcOrderIds.length > 0 ? amcOrderIds : [] },
          });
        } else {
          typeConditions.push({
            amc_id: { $exists: true, $ne: null },
          });
        }
      }
      if (typeValues.includes('customization')) {
        if (hasDateRange) {
          typeConditions.push({
            _id: {
              $in:
                customizationOrderIds.length > 0 ? customizationOrderIds : [],
            },
          });
        } else {
          typeConditions.push({
            customizations: { $exists: true, $ne: [] },
          });
        }
      }
      if (typeValues.includes('auditor_license')) {
        if (hasDateRange) {
          typeConditions.push({
            _id: { $in: licenseOrderIds.length > 0 ? licenseOrderIds : [] },
          });
        } else {
          typeConditions.push({
            licenses: { $exists: true, $ne: [] },
          });
        }
      }
      if (typeValues.includes('additional_service')) {
        if (hasDateRange) {
          typeConditions.push({
            _id: {
              $in:
                additionalServiceOrderIds.length > 0
                  ? additionalServiceOrderIds
                  : [],
            },
          });
        } else {
          typeConditions.push({
            additional_services: { $exists: true, $ne: [] },
          });
        }
      }

      if (typeConditions.length > 0) {
        if (filterQuery.$or) {
          filterQuery.$and = filterQuery.$and || [];
          filterQuery.$and.push({ $or: typeConditions });
        } else {
          filterQuery.$or = typeConditions;
        }
      }
    } else if (parsedStartDate || parsedEndDate) {
      // No types filter: include orders whose main purchase OR any sub-item
      // (customization/license/additional service) falls in the FY.
      const orderDateQuery: any = {};
      if (parsedStartDate && parsedEndDate) {
        orderDateQuery.$gte = parsedStartDate;
        orderDateQuery.$lte = parsedEndDate;
      } else if (parsedStartDate) {
        orderDateQuery.$gte = parsedStartDate;
      } else if (parsedEndDate) {
        orderDateQuery.$lte = parsedEndDate;
      }

      const [ordersInRange, subItemOrderIds] = await Promise.all([
        this.orderModel.collection
          .find({ purchased_date: orderDateQuery })
          .project({ _id: 1 })
          .toArray(),
        this.getOrderIdsBySubItemDateRange(parsedStartDate, parsedEndDate),
      ]);

      const matchingOrderIdStrings = new Set<string>(
        ordersInRange.map((o) => o._id.toString()),
      );
      subItemOrderIds.customizationOrderIds.forEach((id) =>
        matchingOrderIdStrings.add(id.toString()),
      );
      subItemOrderIds.licenseOrderIds.forEach((id) =>
        matchingOrderIdStrings.add(id.toString()),
      );
      subItemOrderIds.additionalServiceOrderIds.forEach((id) =>
        matchingOrderIdStrings.add(id.toString()),
      );

      if (matchingOrderIdStrings.size === 0) {
        filterQuery._id = { $in: [] };
      } else if (
        filterQuery._id &&
        filterQuery._id.$in &&
        Array.isArray(filterQuery._id.$in)
      ) {
        const existingIds = new Set(
          filterQuery._id.$in.map((id: any) => id.toString()),
        );
        const intersectedIds = Array.from(matchingOrderIdStrings)
          .filter((id) => existingIds.has(id))
          .map((id) => new Types.ObjectId(id));
        filterQuery._id = { $in: intersectedIds };
      } else {
        filterQuery._id = {
          $in: Array.from(matchingOrderIdStrings).map(
            (id) => new Types.ObjectId(id),
          ),
        };
      }
    }

    // 7. Filter by includeCancelled
    if (!filters.includeCancelled) {
      filterQuery.$and = filterQuery.$and || [];
      filterQuery.$and.push({
        $or: [{ cancelled_at: { $exists: false } }, { cancelled_at: null }],
      });
    }

    // 8. Filter by Payment Status
    if (
      filters.paymentStatus &&
      Object.values(PAYMENT_STATUS_ENUM).includes(filters.paymentStatus)
    ) {
      const paymentStatusConditions: any[] = [];

      // Orders with matching payment_terms.status (embedded array)
      paymentStatusConditions.push({
        payment_terms: { $elemMatch: { status: filters.paymentStatus } },
      });

      // Query sub-collections for order_ids with matching payment_status
      const [licenseOrderIds, customizationOrderIds, additionalServiceOrderIds] =
        await Promise.all([
          this.licenseModel
            .find({
              payment_status: filters.paymentStatus,
              deleted: { $ne: true },
            })
            .select('order_id')
            .lean<{ order_id: Types.ObjectId }[]>(),
          this.customizationModel
            .find({
              payment_status: filters.paymentStatus,
              deleted: { $ne: true },
            })
            .select('order_id')
            .lean<{ order_id: Types.ObjectId }[]>(),
          this.additionalServiceModel
            .find({
              payment_status: filters.paymentStatus,
              deleted: { $ne: true },
            })
            .select('order_id')
            .lean<{ order_id: Types.ObjectId }[]>(),
        ]);

      const subCollectionOrderIds = [
        ...new Set([
          ...licenseOrderIds.map((l) => String(l.order_id)),
          ...customizationOrderIds.map((c) => String(c.order_id)),
          ...additionalServiceOrderIds.map((s) => String(s.order_id)),
        ]),
      ]
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));

      if (subCollectionOrderIds.length > 0) {
        paymentStatusConditions.push({
          _id: { $in: subCollectionOrderIds },
        });
      }

      if (paymentStatusConditions.length > 0) {
        filterQuery.$and = filterQuery.$and || [];
        filterQuery.$and.push({ $or: paymentStatusConditions });
      }
    }

    // 9. Filter by AMC Start Date Pending
    if (filters.amcPending === true) {
      filterQuery.$and = filterQuery.$and || [];
      filterQuery.$and.push({
        amc_id: { $exists: true, $ne: null },
        $or: [
          { amc_start_date: { $exists: false } },
          { amc_start_date: null },
        ],
      });
    }

    // Normalize client_id to strings for consistency
    if (filterQuery.client_id?.$in) {
      filterQuery.client_id.$in = filterQuery.client_id.$in.map((id) =>
        String(id),
      );
    } else if (filterQuery.client_id) {
      filterQuery.client_id = String(filterQuery.client_id);
    }

    return { filterQuery, parsedStartDate, parsedEndDate };
  }

  private buildDateRangeQuery(startDate?: Date, endDate?: Date): any {
    const query: any = {};
    if (startDate && endDate) {
      query.$gte = startDate;
      query.$lte = endDate;
    } else if (startDate) {
      query.$gte = startDate;
    } else if (endDate) {
      query.$lte = endDate;
    }
    return query;
  }

  private async getOrderIdsBySubItemDateRange(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    customizationOrderIds: Types.ObjectId[];
    licenseOrderIds: Types.ObjectId[];
    additionalServiceOrderIds: Types.ObjectId[];
  }> {
    const dateQuery = this.buildDateRangeQuery(startDate, endDate);
    const empty = {
      customizationOrderIds: [],
      licenseOrderIds: [],
      additionalServiceOrderIds: [],
    };

    if (Object.keys(dateQuery).length === 0) return empty;

    // Legacy rows may store dates in invoice_date, purchase_date or purchased_date.
    // Use raw collection queries so string order_id values are not cast away.
    const dateOr = [
      { invoice_date: dateQuery },
      { purchase_date: dateQuery },
      { purchased_date: dateQuery },
    ];

    const [customizations, licenses, additionalServices] = await Promise.all([
      this.customizationModel.collection
        .find({ $or: dateOr })
        .project({ order_id: 1 })
        .toArray(),
      this.licenseModel.collection
        .find({ $or: dateOr })
        .project({ order_id: 1 })
        .toArray(),
      this.additionalServiceModel.collection
        .find({ $or: dateOr })
        .project({ order_id: 1 })
        .toArray(),
    ]);

    const toObjectIds = (items: any[]): Types.ObjectId[] =>
      [
        ...new Set(
          items
            .map((item) => String(item.order_id))
            .filter((id) => Types.ObjectId.isValid(id)),
        ),
      ].map((id) => new Types.ObjectId(id));

    return {
      customizationOrderIds: toObjectIds(customizations),
      licenseOrderIds: toObjectIds(licenses),
      additionalServiceOrderIds: toObjectIds(additionalServices),
    };
  }

  private toPlainSubItem(doc: any): any {
    if (!doc) return null;
    return typeof doc.toObject === 'function' ? doc.toObject() : doc;
  }

  private mapSubItem(
    subItem: any,
    orderStatus: string,
    type: 'license' | 'customization' | 'additional_service',
  ): any {
    const obj = this.toPlainSubItem(subItem);
    if (!obj) return null;
    obj.status = orderStatus;
    if (obj.purchase_order_document) {
      obj.purchase_order_document = this.storageService.get(
        obj.purchase_order_document,
      );
    }
    if (type === 'license' && obj.invoice_document) {
      obj.invoice_document = this.storageService.get(obj.invoice_document);
    }
    if (type === 'additional_service' && obj.service_document) {
      obj.service_document = this.storageService.get(obj.service_document);
    }
    return obj;
  }

  private mergeSubItems(existing: any[], standalone: any[]): any[] {
    const map = new Map<string, any>();
    for (const item of existing) {
      const plain = this.toPlainSubItem(item);
      if (plain && plain._id) map.set(plain._id.toString(), plain);
    }
    for (const item of standalone) {
      const plain = this.toPlainSubItem(item);
      if (plain && plain._id && !map.has(plain._id.toString())) {
        map.set(plain._id.toString(), plain);
      }
    }
    return Array.from(map.values());
  }

  private getSubItemEffectiveDate(item: any): Date | null {
    if (!item) return null;
    const raw =
      item.invoice_date || item.purchase_date || item.purchased_date || null;
    return raw ? new Date(raw) : null;
  }

  private filterSubItemsByDate(
    items: any[],
    startDate?: Date,
    endDate?: Date,
  ): any[] {
    if (!startDate && !endDate) return items;
    return items.filter((item) => {
      const d = this.getSubItemEffectiveDate(item);
      if (!d) return false;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }

  async loadAllOrdersWithAttributes(
    page: number,
    limit: number,
    filters: OrderFilterOptions = {},
  ): Promise<{
    purchases: any[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    try {
      this.loggerService.log(
        JSON.stringify({
          message:
            'loadAllOrdersWithAttributes: Fetching orders with pagination and filters',
          data: { page, limit, filters },
        }),
      );

      const { filterQuery, parsedStartDate, parsedEndDate } =
        await this.buildOrderFilterQuery(
          filters,
          'loadAllOrdersWithAttributes',
        );

      this.loggerService.log(
        JSON.stringify({
          message: 'loadAllOrdersWithAttributes: Constructed filter query',
          filterQuery,
        }),
      );

      const skip = (page - 1) * limit;

      // Fetch Total Count with Filters
      const totalOrders = await this.orderModel.countDocuments(filterQuery);

      if (totalOrders === 0) {
        this.loggerService.log(
          JSON.stringify({
            message: 'loadAllOrdersWithAttributes: No orders found',
            filterQuery,
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
        };
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'loadAllOrdersWithAttributes: Total orders',
          totalOrders,
        }),
      );

      // Fetch Paginated Orders with Filters and Population
      const orders = await this.orderModel
        .find(filterQuery)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate([
          {
            path: 'licenses',
            model: License.name,
            select:
              '_id purchase_order_number purchase_date invoice_number rate total_license payment_status',
          },
          {
            path: 'customizations',
            model: Customization.name,
            select:
              '_id type purchase_order_number cost modules purchased_date',
          },
          { path: 'additional_services', model: AdditionalService.name },
          { path: 'client_id', select: 'name parent_company_id' },
          { path: 'products', model: Product.name },
          { path: 'amc_id', select: '_id' },
        ]);

      this.loggerService.log(
        JSON.stringify({
          message: 'loadAllOrdersWithAttributes: Orders fetched successfully',
          count: orders.length,
          page,
          limit,
        }),
      );

      const typeValues = filters.types
        ? filters.types.split(',').map((t) => t.trim().toLowerCase())
        : [];

      // Fetch standalone sub-items in one batch. They live in separate
      // collections and are often missing from the order's embedded arrays.
      const orderIds = orders.map((o: any) => o._id.toString());
      const [standaloneLicenses, standaloneCustomizations, standaloneAdditionalServices] =
        await Promise.all([
          this.licenseModel.collection
            .find({ order_id: { $in: orderIds } })
            .toArray(),
          this.customizationModel.collection
            .find({ order_id: { $in: orderIds } })
            .toArray(),
          this.additionalServiceModel.collection
            .find({ order_id: { $in: orderIds } })
            .toArray(),
        ]);

      const groupByOrderId = (items: any[]) => {
        const map = new Map<string, any[]>();
        for (const item of items) {
          const oid = String(item.order_id);
          if (!map.has(oid)) map.set(oid, []);
          map.get(oid)!.push(item);
        }
        return map;
      };

      const licenseMap = groupByOrderId(standaloneLicenses);
      const customizationMap = groupByOrderId(standaloneCustomizations);
      const additionalServiceMap = groupByOrderId(standaloneAdditionalServices);

      // Process Orders
      const processedOrders = await Promise.all(
        orders.map(async (order: any) => {
          const orderObj: any = order.toObject();
          orderObj.purchase_type = PURCHASE_TYPE.ORDER;

          // Process Client and Parent Company Info
          if (order.client_id && orderObj.client_id) {
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
              agreementObj.document = agreement?.document
                ? this.storageService.get(agreement.document)
                : null;
              return agreementObj;
            });
          } else {
            orderObj.agreements = [];
          }

          // Add has_* flags based on merged standalone + populated sub-items
          const orderId = orderObj._id.toString();

          orderObj.licenses = this.mergeSubItems(
            order.licenses || [],
            licenseMap.get(orderId) || [],
          )
            .map((item) => this.mapSubItem(item, order.status, 'license'))
            .filter(Boolean);

          orderObj.customizations = this.mergeSubItems(
            order.customizations || [],
            customizationMap.get(orderId) || [],
          )
            .map((item) => this.mapSubItem(item, order.status, 'customization'))
            .filter(Boolean);

          orderObj.additional_services = this.mergeSubItems(
            order.additional_services || [],
            additionalServiceMap.get(orderId) || [],
          )
            .map((item) =>
              this.mapSubItem(item, order.status, 'additional_service'),
            )
            .filter(Boolean);

          // Filter sub-items by effective date (invoice_date fallback to purchase dates)
          if (parsedStartDate || parsedEndDate) {
            orderObj.licenses = this.filterSubItemsByDate(
              orderObj.licenses,
              parsedStartDate,
              parsedEndDate,
            );
            orderObj.customizations = this.filterSubItemsByDate(
              orderObj.customizations,
              parsedStartDate,
              parsedEndDate,
            );
            orderObj.additional_services = this.filterSubItemsByDate(
              orderObj.additional_services,
              parsedStartDate,
              parsedEndDate,
            );
          }

          orderObj.has_licenses = orderObj.licenses.length > 0;
          orderObj.has_customizations = orderObj.customizations.length > 0;
          orderObj.has_amc = order.amc_id != null;

          return orderObj;
        }),
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'loadAllOrdersWithAttributes: Completed processing orders',
          data: { processedCount: processedOrders.length },
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

      if (amcObject.amc_start_logs && amcObject.amc_start_logs.length) {
        amcObject.amc_start_logs = amcObject.amc_start_logs.map((log: any) => ({
          ...log,
          from: log.from ? new Date(log.from) : log.from,
          to: log.to ? new Date(log.to) : log.to,
          date: log.date ? new Date(log.date) : log.date,
          user: log.user ? log.user.toString() : log.user,
        }));
      }

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

  async deleteLicenseById(id: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'deleteLicenseById: Starting deletion',
          id,
        }),
      );

      const license = await this.licenseModel.findById(id);
      if (!license) {
        throw new HttpException('License not found', HttpStatus.NOT_FOUND);
      }

      const order = await this.orderModel
        .findById(license.order_id)
        .populate('amc_id');
      if (!order) {
        throw new HttpException('Parent order not found', HttpStatus.NOT_FOUND);
      }

      const cost = (license.rate?.amount ?? 0) * (license.total_license ?? 0);
      const amcRate = license.amc_rate?.percentage ?? 0;
      const amcAmount = (cost / 100) * amcRate;

      if (order.amc_id) {
        const amc: any = order.amc_id;
        await this.amcModel.findByIdAndUpdate(amc._id, {
          total_cost: Math.max(0, (amc.total_cost ?? 0) - cost),
          amount: Math.max(0, (amc.amount ?? 0) - amcAmount),
        });
      }

      await this.orderModel.findByIdAndUpdate(order._id, {
        $pull: { licenses: new Types.ObjectId(id) },
      });

      await this.reminderModel.deleteMany({ license_id: id });

      if (license.purchase_order_document) {
        const key = extractFileKey(license.purchase_order_document);
        this.storageService.delete(key);
      }
      if (license.invoice_document) {
        const key = extractFileKey(license.invoice_document);
        this.storageService.delete(key);
      }

      await this.licenseModel.findByIdAndDelete(id);

      this.loggerService.log(
        JSON.stringify({
          message: 'deleteLicenseById: License deleted successfully',
          id,
        }),
      );

      return { message: 'License deleted successfully', id };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'deleteLicenseById: Error deleting license',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteCustomizationById(id: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'deleteCustomizationById: Starting deletion',
          id,
        }),
      );

      const customization = await this.customizationModel.findById(id);
      if (!customization) {
        throw new HttpException(
          'Customization not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const order = await this.orderModel
        .findById(customization.order_id)
        .populate('amc_id');
      if (!order) {
        throw new HttpException('Parent order not found', HttpStatus.NOT_FOUND);
      }

      const cost = customization.cost ?? 0;
      const amcRate = customization.amc_rate?.percentage ?? 0;
      const amcAmount = (cost / 100) * amcRate;

      if (order.amc_id) {
        const amc: any = order.amc_id;
        await this.amcModel.findByIdAndUpdate(amc._id, {
          total_cost: Math.max(0, (amc.total_cost ?? 0) - cost),
          amount: Math.max(0, (amc.amount ?? 0) - amcAmount),
        });
      }

      await this.orderModel.findByIdAndUpdate(order._id, {
        $pull: { customizations: new Types.ObjectId(id) },
      });

      await this.reminderModel.deleteMany({ customization_id: id });

      if (customization.purchase_order_document) {
        const key = extractFileKey(customization.purchase_order_document);
        this.storageService.delete(key);
      }
      if (customization.invoice_document) {
        const key = extractFileKey(customization.invoice_document);
        this.storageService.delete(key);
      }

      await this.customizationModel.findByIdAndDelete(id);

      this.loggerService.log(
        JSON.stringify({
          message: 'deleteCustomizationById: Customization deleted successfully',
          id,
        }),
      );

      return { message: 'Customization deleted successfully', id };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'deleteCustomizationById: Error deleting customization',
          error: error.message,
        }),
      );
      throw new HttpException(
        error.message || 'Server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteAdditionalServiceById(id: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'deleteAdditionalServiceById: Starting deletion',
          id,
        }),
      );

      const additionalService = await this.additionalServiceModel.findById(id);
      if (!additionalService) {
        throw new HttpException(
          'Additional service not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const order = await this.orderModel
        .findById(additionalService.order_id)
        .populate('amc_id');
      if (!order) {
        throw new HttpException('Parent order not found', HttpStatus.NOT_FOUND);
      }

      const cost = additionalService.cost ?? 0;
      const amcRate = additionalService.amc_rate?.percentage ?? 0;
      const amcAmount = (cost / 100) * amcRate;

      if (order.amc_id) {
        const amc: any = order.amc_id;
        await this.amcModel.findByIdAndUpdate(amc._id, {
          total_cost: Math.max(0, (amc.total_cost ?? 0) - cost),
          amount: Math.max(0, (amc.amount ?? 0) - amcAmount),
        });
      }

      await this.orderModel.findByIdAndUpdate(order._id, {
        $pull: { additional_services: new Types.ObjectId(id) },
      });

      if (additionalService.purchase_order_document) {
        const key = extractFileKey(additionalService.purchase_order_document);
        this.storageService.delete(key);
      }
      if (additionalService.invoice_document) {
        const key = extractFileKey(additionalService.invoice_document);
        this.storageService.delete(key);
      }
      if (additionalService.service_document) {
        const key = extractFileKey(additionalService.service_document);
        this.storageService.delete(key);
      }

      await this.additionalServiceModel.findByIdAndDelete(id);

      this.loggerService.log(
        JSON.stringify({
          message:
            'deleteAdditionalServiceById: Additional service deleted successfully',
          id,
        }),
      );

      return { message: 'Additional service deleted successfully', id };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message:
            'deleteAdditionalServiceById: Error deleting additional service',
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
      // Destructure all fields from DTO
      const {
        cost_per_license,
        product_id,
        total_license,
        licenses_with_base_price,
        purchase_date,
        purchase_order_document,
        purchase_order_number,
        invoice_number,
        invoice_date,
        invoice_document,
        payment_status,
        payment_receive_date,
      } = body;

      this.loggerService.log(
        JSON.stringify({
          message: 'updateLicense: Updating license',
          id,
          body,
        }),
      );

      // Prepare update object, converting date strings to Date objects where needed
      const updateObj: any = {
        'rate.amount': cost_per_license,
        'rate.percentage': 0,
        total_license,
        product_id,
        purchase_date: purchase_date ? new Date(purchase_date) : undefined,
        purchase_order_document,
        purchase_order_number,
        invoice_number,
        invoice_date: invoice_date ? new Date(invoice_date) : undefined,
        invoice_document,
        payment_status,
        payment_receive_date: payment_receive_date
          ? new Date(payment_receive_date)
          : undefined,
      };
      if (licenses_with_base_price !== undefined) {
        updateObj.licenses_with_base_price = licenses_with_base_price;
      }

      // Remove undefined fields to avoid overwriting with undefined
      Object.keys(updateObj).forEach(
        (key) => updateObj[key] === undefined && delete updateObj[key],
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'updateLicense: Update object prepared',
          id,
          updateObj,
        }),
      );

      const license = await this.licenseModel.findByIdAndUpdate(
        id,
        { $set: updateObj },
        { new: true },
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'updateLicense: License updated successfully',
          id,
          updatedLicense: license,
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
        const identifiers = options.productId.split(',').map((id) => id.trim());
        const objectIds: (Types.ObjectId | string)[] = [];
        const shortNames: string[] = [];
        identifiers.forEach((identifier) => {
          if (Types.ObjectId.isValid(identifier)) {
            objectIds.push(new Types.ObjectId(identifier));
            objectIds.push(identifier); // Add string version too
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
        amcQuery.products =
          objectIds.length > 0 ? { $in: objectIds } : { $in: [] };
        this.loggerService.log(
          JSON.stringify({
            message: 'loadAllAMC: Product filter applied',
            data: {
              originalProductId: options.productId,
              identifiers,
              shortNames,
              objectIds: objectIds.map((id) => id.toString()),
              filterQuery: amcQuery.products,
            },
          }),
        );
      }

      // Fetch all AMCs with necessary relationships
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
                  payment.status === PAYMENT_STATUS_ENUM.PROFORMA &&
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
                    payment.status === PAYMENT_STATUS_ENUM.PROFORMA &&
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
              path: 'additional_services',
              model: AdditionalService.name,
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

              // Calculate total cost including customizations, licenses, and additional services
              let totalCost = order.base_cost;
              // AMC from base cost
              let amcAmount = (order.base_cost / 100) * order.amc_rate.percentage;

              // Add customization costs with per-line-item AMC
              const customizations = order.customizations || [];
              for (const customization of customizations) {
                totalCost += customization.cost || 0;
                amcAmount += customization.amc_rate?.amount || 0;
              }

              // Add license costs with per-line-item AMC
              const licenses = order.licenses || [];
              for (const license of licenses) {
                const licenseCost =
                  (license.rate?.amount || 0) * (license.total_license || 0);
                totalCost += licenseCost;
                amcAmount += license.amc_rate?.amount || 0;
              }

              // Add additional service costs with per-line-item AMC
              const additionalServices = order.additional_services || [];
              for (const service of additionalServices) {
                totalCost += service.cost || 0;
                amcAmount += service.amc_rate?.amount || 0;
              }

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
    // Calculate total cost including customizations, licenses, and additional services
    let totalCost = order.base_cost;
    // AMC from base cost
    let amcAmount = (order.base_cost / 100) * order.amc_rate.percentage;

    // Add customization costs with per-line-item AMC
    const customizations = order.customizations || [];
    for (const customization of customizations) {
      totalCost += customization.cost || 0;
      amcAmount += customization.amc_rate?.amount || 0;
    }

    // Add license costs with per-line-item AMC
    const licenses = order.licenses || [];
    for (const license of licenses) {
      const licenseCost =
        (license.rate?.amount || 0) * (license.total_license || 0);
      totalCost += licenseCost;
      amcAmount += license.amc_rate?.amount || 0;
    }

    // Add additional service costs with per-line-item AMC
    const additionalServices = order.additional_services || [];
    for (const service of additionalServices) {
      totalCost += service.cost || 0;
      amcAmount += service.amc_rate?.amount || 0;
    }

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
          path: 'additional_services',
          model: AdditionalService.name,
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

      console.log(payments);
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

      this.loggerService.log(
        JSON.stringify({
          message: 'getAmcReviewByOrderId: Debugging Customizations',
          count: customizations?.length,
          customizations: customizations?.map((c) => ({
            id: c._id,
            date: c.purchased_date,
            cost: c.cost,
          })),
        }),
      );

      for (const customization of customizations) {
        let purchaseDate = customization.purchased_date
          ? new Date(customization.purchased_date)
          : new Date(order.purchased_date);

        // Normalize to start of day
        purchaseDate.setHours(0, 0, 0, 0);

        this.loggerService.log(
          JSON.stringify({
            message: 'getAmcReviewByOrderId: Processing customization cost',
            data: {
              orderId,
              customizationId: customization._id,
              purchaseDate: purchaseDate.toISOString(),
              customizationCost: customization.cost,
              usingOrderDate: !customization.purchased_date,
              orderPurchasedDate: order.purchased_date,
            },
          }),
        );

        for (const payment of payments) {
          const paymentDate = new Date(payment.from_date);
          paymentDate.setHours(0, 0, 0, 0);

          const shouldAdd = purchaseDate <= paymentDate;

          this.loggerService.log(
            JSON.stringify({
              message:
                'getAmcReviewByOrderId: Checking payment for customization',
              paymentDate: paymentDate.toISOString(),
              purchaseDate: purchaseDate.toISOString(),
              shouldAdd,
              currentTotal: payment.total_cost,
            }),
          );

          // If purchased on or before the payment date, include the cost
          if (shouldAdd) {
            const newTotalCost = payment.total_cost + customization.cost;
            // Use line-item AMC amount instead of recalculating with parent percentage
            const newAmount = payment.amc_rate_amount + (customization.amc_rate?.amount || 0);

            payment.amc_rate_amount = newAmount;
            payment.total_cost = newTotalCost;
          }
        }
      }

      const licenses = order.licenses as unknown as LicenseDocument[];

      this.loggerService.log(
        JSON.stringify({
          message: 'getAmcReviewByOrderId: Debugging Licenses',
          count: licenses?.length,
          licenses: licenses?.map((l) => ({
            id: l._id,
            date: l.purchase_date,
            total: l.total_license,
          })),
        }),
      );

      for (const license of licenses) {
        let purchaseDate = license.purchase_date
          ? new Date(license.purchase_date)
          : new Date(order.purchased_date);

        // Normalize to start of day
        purchaseDate.setHours(0, 0, 0, 0);

        const licenseCost = license.rate?.amount * license.total_license;

        this.loggerService.log(
          JSON.stringify({
            message: 'getAmcReviewByOrderId: Processing license cost',
            data: {
              orderId,
              licenseId: license._id,
              purchaseDate: purchaseDate.toISOString(),
              licenseCost,
              totalLicenses: license.total_license,
              licenseRate: license.rate?.amount,
              usingOrderDate: !license.purchase_date,
            },
          }),
        );

        for (const payment of payments) {
          const paymentDate = new Date(payment.from_date);
          paymentDate.setHours(0, 0, 0, 0);

          const shouldAdd = purchaseDate <= paymentDate;

          // If purchased on or before the payment date, include the cost
          if (shouldAdd) {
            const newTotalCost = payment.total_cost + licenseCost;
            // Use line-item AMC amount instead of recalculating with parent percentage
            const newAmount = payment.amc_rate_amount + (license.amc_rate?.amount || 0);

            payment.amc_rate_amount = newAmount;
            payment.total_cost = newTotalCost;
          }
        }
      }

      // Process additional services with per-line-item AMC
      const additionalServices = (order as any).additional_services || [];

      for (const service of additionalServices) {
        let purchaseDate = service.date?.start
          ? new Date(service.date.start)
          : new Date(order.purchased_date);

        // Normalize to start of day
        purchaseDate.setHours(0, 0, 0, 0);

        for (const payment of payments) {
          const paymentDate = new Date(payment.from_date);
          paymentDate.setHours(0, 0, 0, 0);

          const shouldAdd = purchaseDate <= paymentDate;

          if (shouldAdd) {
            const newTotalCost = payment.total_cost + (service.cost || 0);
            const newAmount = payment.amc_rate_amount + (service.amc_rate?.amount || 0);

            payment.amc_rate_amount = newAmount;
            payment.total_cost = newTotalCost;
          }
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

  async cancelOrder(orderId: string, reason: string, cancelledProducts?: string[]) {
    if (!orderId) {
      throw new HttpException('Order id is required', HttpStatus.BAD_REQUEST);
    }
    if (!reason) {
      throw new HttpException('Cancellation reason is required', HttpStatus.BAD_REQUEST);
    }

    const existingOrder = await this.orderModel.findById(orderId);
    if (!existingOrder) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (
      existingOrder.status === ORDER_STATUS_ENUM.INACTIVE ||
      existingOrder.cancelled_at
    ) {
      throw new HttpException(
        'Order is already cancelled or inactive',
        HttpStatus.CONFLICT,
      );
    }

    const previousStatus = existingOrder.status;

    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: orderId,
        status: { $ne: ORDER_STATUS_ENUM.INACTIVE },
        cancelled_at: { $exists: false },
      },
      {
        $set: {
          status: ORDER_STATUS_ENUM.INACTIVE,
          cancelled_at: new Date(),
          cancellation_reason: reason,
          ...(cancelledProducts?.length
            ? { cancelled_products: cancelledProducts }
            : {}),
        },
        $push: {
          status_logs: {
            from: previousStatus,
            to: ORDER_STATUS_ENUM.INACTIVE,
            date: new Date(),
            user: null as any,
          },
        },
      },
      { new: true },
    );

    if (!order) {
      throw new HttpException(
        'Order was modified by another request. Please try again.',
        HttpStatus.CONFLICT,
      );
    }

    this.loggerService.log(
      JSON.stringify({
        message: 'cancelOrder: Order cancelled',
        orderId,
        reason,
        cancelledProducts,
      }),
    );

    return {
      message: 'Order cancelled successfully',
      orderId: order._id,
      status: order.status,
      cancelled_at: order.cancelled_at,
      cancellation_reason: order.cancellation_reason,
    };
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

      // Fetch all clients via raw collection to avoid Mongoose casting mixed-type refs
      const clients = await this.clientModel.collection
        .find()
        .project({ _id: 1, name: 1, parent_company_id: 1 })
        .toArray();

      const clientCompanyMap = new Map<string, { _id: string; name: string }>();
      const parentCompanyMap = new Map<string, { _id: string; name: string }>();
      const parentCompanyIds = new Set<string>();

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

        // Collect parent company id (legacy data stores it as a string)
        if (client.parent_company_id) {
          const parentIdStr =
            typeof client.parent_company_id === 'string'
              ? client.parent_company_id
              : client.parent_company_id.toString();
          parentCompanyIds.add(parentIdStr);
        }
      }

      // Fetch parent company names in one batch
      if (parentCompanyIds.size > 0) {
        const parentCompanies = await this.clientModel.collection
          .find({
            _id: {
              $in: Array.from(parentCompanyIds).map(
                (id) => new Types.ObjectId(id),
              ),
            },
          })
          .project({ _id: 1, name: 1 })
          .toArray();

        for (const parent of parentCompanies) {
          const parentIdStr = parent._id.toString();
          if (!parentCompanyMap.has(parentIdStr)) {
            parentCompanyMap.set(parentIdStr, {
              _id: parentIdStr,
              name: parent.name || 'Unnamed Parent Company',
            });
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

      // Define columns for the data table
      const columns = [
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
        const identifiers = options.productId.split(',').map((id) => id.trim());
        const objectIds: (Types.ObjectId | string)[] = [];
        const shortNames: string[] = [];
        identifiers.forEach((identifier) => {
          if (Types.ObjectId.isValid(identifier)) {
            objectIds.push(new Types.ObjectId(identifier));
            objectIds.push(identifier); // Add string version too
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
        amcQuery.products =
          objectIds.length > 0 ? { $in: objectIds } : { $in: [] };
        this.loggerService.log(
          JSON.stringify({
            message: 'loadAllAMC: Product filter applied',
            data: {
              originalProductId: options.productId,
              identifiers,
              shortNames,
              objectIds: objectIds.map((id) => id.toString()),
              filterQuery: amcQuery.products,
            },
          }),
        );
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
                  payment.status === PAYMENT_STATUS_ENUM.PROFORMA &&
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

      // Set columns using the pre-defined columns variable, but without creating a header row
      worksheet.columns = columns.map((col) => ({
        key: col.key,
        width: col.width,
      }));

      // Manually add the header row
      const headerRow = worksheet.addRow(columns.map((col) => col.header));
      headerRow.eachCell((cell) => {
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
                  payment.status === PAYMENT_STATUS_ENUM.PROFORMA &&
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
          case PAYMENT_STATUS_ENUM.PROFORMA:
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

  async exportPurchasesToExcel(
    filters: OrderFilterOptions = {},
  ): Promise<Buffer> {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'exportPurchasesToExcel: Generating Excel export',
          filters,
        }),
      );

      // Define columns for the data table
      const columns = [
        { header: 'Client', key: 'client', width: 25 },
        { header: 'Parent Company', key: 'parentCompany', width: 25 },
        { header: 'Products', key: 'products', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Base Cost', key: 'baseCost', width: 15 },
        { header: 'AMC Rate %', key: 'amcRatePercentage', width: 12 },
        { header: 'AMC Amount', key: 'amcAmount', width: 15 },
        { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
        { header: 'AMC Start Date', key: 'amcStartDate', width: 15 },
        { header: 'Licenses Count', key: 'licensesCount', width: 12 },
        {
          header: 'Customizations Count',
          key: 'customizationsCount',
          width: 18,
        },
        {
          header: 'Additional Services Count',
          key: 'additionalServicesCount',
          width: 20,
        },
        { header: 'Training Cost', key: 'trainingCost', width: 15 },
        { header: 'Purchase Order', key: 'purchaseOrderNumber', width: 20 },
      ];

      // Import Excel library dynamically
      const ExcelJS = require('exceljs');

      // Create a new Excel workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Purchases Management System';
      workbook.lastModifiedBy = 'Purchases Management System';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('Purchases Data', {
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

      const { filterQuery, parsedStartDate, parsedEndDate } =
        await this.buildOrderFilterQuery(filters, 'exportPurchasesToExcel');

      this.loggerService.log(
        JSON.stringify({
          message: 'exportPurchasesToExcel: Constructed filter query',
          filterQuery,
        }),
      );

      // Fetch all matching orders (no pagination for export)
      const orders = await this.orderModel
        .find(filterQuery)
        .sort({ createdAt: -1 })
        .populate([
          { path: 'licenses', model: License.name },
          { path: 'customizations', model: Customization.name },
          { path: 'additional_services', model: AdditionalService.name },
          { path: 'client_id', select: 'name parent_company_id' },
          { path: 'products', model: Product.name },
        ]);

      this.loggerService.log(
        JSON.stringify({
          message: 'exportPurchasesToExcel: Orders fetched for export',
          count: orders.length,
        }),
      );

      const typeValues = filters.types
        ? filters.types.split(',').map((t) => t.trim().toLowerCase())
        : [];

      // Fetch standalone sub-items in one batch.
      const orderIds = orders.map((o: any) => o._id.toString());
      const [standaloneLicenses, standaloneCustomizations, standaloneAdditionalServices] =
        await Promise.all([
          this.licenseModel.collection
            .find({ order_id: { $in: orderIds } })
            .toArray(),
          this.customizationModel.collection
            .find({ order_id: { $in: orderIds } })
            .toArray(),
          this.additionalServiceModel.collection
            .find({ order_id: { $in: orderIds } })
            .toArray(),
        ]);

      const groupByOrderId = (items: any[]) => {
        const map = new Map<string, any[]>();
        for (const item of items) {
          const oid = String(item.order_id);
          if (!map.has(oid)) map.set(oid, []);
          map.get(oid)!.push(item);
        }
        return map;
      };

      const licenseMap = groupByOrderId(standaloneLicenses);
      const customizationMap = groupByOrderId(standaloneCustomizations);
      const additionalServiceMap = groupByOrderId(standaloneAdditionalServices);

      // Process orders similar to loadAllOrdersWithAttributes
      const processedOrders = await Promise.all(
        orders.map(async (order: any) => {
          const orderObj: any = order.toObject();

          // Process Client and Parent Company Info
          if (order.client_id && orderObj.client_id) {
            try {
              const parentCompanyId = order.client_id?.parent_company_id;
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
              this.loggerService.warn(
                JSON.stringify({
                  message:
                    'exportPurchasesToExcel: Error processing parent company',
                  orderId: order._id?.toString(),
                  error:
                    error instanceof Error ? error.message : 'Unknown error',
                }),
              );
            }
          }

          // Merge standalone sub-items and filter by effective date
          const orderId = orderObj._id.toString();

          orderObj.licenses = this.mergeSubItems(
            orderObj.licenses || [],
            licenseMap.get(orderId) || [],
          );
          orderObj.customizations = this.mergeSubItems(
            orderObj.customizations || [],
            customizationMap.get(orderId) || [],
          );
          orderObj.additional_services = this.mergeSubItems(
            orderObj.additional_services || [],
            additionalServiceMap.get(orderId) || [],
          );

          if (parsedStartDate || parsedEndDate) {
            orderObj.licenses = this.filterSubItemsByDate(
              orderObj.licenses,
              parsedStartDate,
              parsedEndDate,
            );
            orderObj.customizations = this.filterSubItemsByDate(
              orderObj.customizations,
              parsedStartDate,
              parsedEndDate,
            );
            orderObj.additional_services = this.filterSubItemsByDate(
              orderObj.additional_services,
              parsedStartDate,
              parsedEndDate,
            );
          }

          return orderObj;
        }),
      );

      // Calculate totals
      const totalBaseCost = processedOrders.reduce(
        (sum, order) => sum + (order.base_cost || 0),
        0,
      );
      const totalAmcAmount = processedOrders.reduce(
        (sum, order) => sum + (order.amc_rate?.amount || 0),
        0,
      );
      const totalTrainingCost = processedOrders.reduce(
        (sum, order) => sum + (order.training_and_implementation_cost || 0),
        0,
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

      const statusStyle: Partial<ExcelJS.Style> = {
        ...dataStyle,
        alignment: { horizontal: 'center', vertical: 'middle' },
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

      // Add report header
      worksheet.addRow(['Purchases Export Report']).font = {
        size: 16,
        bold: true,
      };
      worksheet.addRow(['Generated on:', new Date()]).getCell(2).style =
        dateStyle;

      // Add applied filters info
      const appliedFilters = [];
      if (filters.clientName)
        appliedFilters.push(`Client: ${filters.clientName}`);
      if (filters.status) appliedFilters.push(`Status: ${filters.status}`);
      if (filters.productId)
        appliedFilters.push(`Product: ${filters.productId}`);
      if (filters.types)
        appliedFilters.push(`Types: ${filters.types}`);
      if (parsedStartDate || parsedEndDate) {
        const dateRange =
          parsedStartDate && parsedEndDate
            ? `${parsedStartDate.toISOString().split('T')[0]} to ${parsedEndDate.toISOString().split('T')[0]}`
            : parsedStartDate
              ? `From ${parsedStartDate.toISOString().split('T')[0]}`
              : `Until ${parsedEndDate.toISOString().split('T')[0]}`;
        appliedFilters.push(`Date Range: ${dateRange}`);
      }

      const filtersRow = worksheet.addRow([
        'Applied Filters:',
        appliedFilters.join(', ') || 'None',
      ]);
      filtersRow.getCell(1).font = { bold: true };

      worksheet.addRow(['Total Records:', processedOrders.length]);
      worksheet.addRow([]);

      // Add summary section
      const summaryRow = worksheet.addRow(['Summary']);
      summaryRow.font = { size: 14, bold: true };

      const summaryHeaderRow = worksheet.addRow(['Metric', 'Total Amount']);
      summaryHeaderRow.eachCell((cell) => {
        cell.style = headerStyle;
      });

      const summaryData = [
        ['Total Base Cost', totalBaseCost],
        ['Total AMC Amount', totalAmcAmount],
        ['Total Training Cost', totalTrainingCost],
        ['GRAND TOTAL', totalBaseCost + totalAmcAmount + totalTrainingCost],
      ];

      summaryData.forEach(([metric, amount], index) => {
        const row = worksheet.addRow([metric, amount]);
        row.getCell(1).style =
          index === summaryData.length - 1 ? totalRowStyle : dataStyle;
        row.getCell(2).style =
          index === summaryData.length - 1 ? totalAmountStyle : amountStyle;
      });

      worksheet.addRow([]);
      worksheet.addRow([]);

      // Set columns
      worksheet.columns = columns.map((col) => ({
        key: col.key,
        width: col.width,
      }));

      // Add header row
      const headerRow = worksheet.addRow(columns.map((col) => col.header));
      headerRow.eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Add data rows
      processedOrders.forEach((order) => {
        const row = worksheet.addRow({
          client: order.client_id?.name || 'Unknown Client',
          parentCompany: order.client_id?.parent_company?.name || 'N/A',
          products:
            order.products?.map((p) => p.short_name || p.name).join(', ') ||
            'Unknown Product',
          status: order.status || 'Unknown',
          baseCost: order.base_cost || 0,
          amcRatePercentage: Number(
            Number(order.amc_rate?.percentage || 0).toFixed(2),
          ),
          amcAmount: order.amc_rate?.amount || 0,
          purchaseDate: order.purchased_date,
          amcStartDate: order.amc_start_date,
          licensesCount: order.licenses?.length || 0,
          customizationsCount: order.customizations?.length || 0,
          additionalServicesCount: order.additional_services?.length || 0,
          trainingCost: order.training_and_implementation_cost || 0,
          purchaseOrderNumber: order.purchase_order_number || 'N/A',
        });

        // Apply styles to each cell
        row.getCell('client').style = dataStyle;
        row.getCell('parentCompany').style = dataStyle;
        row.getCell('products').style = dataStyle;

        // Status cell with color coding
        let statusCellStyle: Partial<ExcelJS.Style> = {
          ...statusStyle,
          font: { color: { argb: 'FFFFFF' } },
        };

        switch (order.status) {
          case ORDER_STATUS_ENUM.ACTIVE:
            statusCellStyle.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: '10B981' },
            } as ExcelJS.FillPattern;
            break;
          case ORDER_STATUS_ENUM.INACTIVE:
            statusCellStyle.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'EF4444' },
            } as ExcelJS.FillPattern;
            break;
          // case ORDER_STATUS_ENUM.PENDING:
          //   statusCellStyle.font = { color: { argb: '000000' } };
          //   statusCellStyle.fill = {
          //     type: 'pattern',
          //     pattern: 'solid',
          //     fgColor: { argb: 'F59E0B' },
          //   } as ExcelJS.FillPattern;
          //   break;
          default:
            statusCellStyle.font = { color: { argb: '000000' } };
            statusCellStyle.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'E5E7EB' },
            } as ExcelJS.FillPattern;
        }
        row.getCell('status').style = statusCellStyle;

        // Apply amount and date styles
        row.getCell('baseCost').style = amountStyle;
        row.getCell('amcRatePercentage').style = {
          ...dataStyle,
          alignment: { horizontal: 'center', vertical: 'middle' },
        };
        row.getCell('amcAmount').style = amountStyle;
        row.getCell('purchaseDate').style = dateStyle;
        row.getCell('amcStartDate').style = dateStyle;
        row.getCell('licensesCount').style = {
          ...dataStyle,
          alignment: { horizontal: 'center', vertical: 'middle' },
        };
        row.getCell('customizationsCount').style = {
          ...dataStyle,
          alignment: { horizontal: 'center', vertical: 'middle' },
        };
        row.getCell('additionalServicesCount').style = {
          ...dataStyle,
          alignment: { horizontal: 'center', vertical: 'middle' },
        };
        row.getCell('trainingCost').style = amountStyle;
        row.getCell('purchaseOrderNumber').style = dataStyle;
      });

      // Add total row
      const totalRow = worksheet.addRow({
        client: 'TOTAL',
        baseCost: totalBaseCost,
        amcAmount: totalAmcAmount,
        trainingCost: totalTrainingCost,
      });

      // Apply total row styling
      totalRow.getCell('client').style = totalRowStyle;
      totalRow.getCell('parentCompany').style = totalRowStyle;
      totalRow.getCell('products').style = totalRowStyle;
      totalRow.getCell('status').style = totalRowStyle;
      totalRow.getCell('baseCost').style = totalAmountStyle;
      totalRow.getCell('amcRatePercentage').style = totalRowStyle;
      totalRow.getCell('amcAmount').style = totalAmountStyle;
      totalRow.getCell('purchaseDate').style = totalRowStyle;
      totalRow.getCell('amcStartDate').style = totalRowStyle;
      totalRow.getCell('licensesCount').style = totalRowStyle;
      totalRow.getCell('customizationsCount').style = totalRowStyle;
      totalRow.getCell('additionalServicesCount').style = totalRowStyle;
      totalRow.getCell('trainingCost').style = totalAmountStyle;
      totalRow.getCell('purchaseOrderNumber').style = totalRowStyle;

      // Auto-filter the data table
      if (processedOrders.length > 0) {
        worksheet.autoFilter = {
          from: {
            row: worksheet.rowCount - processedOrders.length - 1,
            column: 1,
          },
          to: { row: worksheet.rowCount - 1, column: columns.length },
        };
      }

      // Generate the Excel file buffer
      const buffer = await workbook.xlsx.writeBuffer();

      this.loggerService.log(
        JSON.stringify({
          message:
            'exportPurchasesToExcel: Excel export generated successfully',
          rowCount: worksheet.rowCount,
          orderCount: processedOrders.length,
          totalBaseCost,
          totalAmcAmount,
          totalTrainingCost,
        }),
      );

      return buffer;
    } catch (error: any) {
      console.log(error);
      this.loggerService.error(
        JSON.stringify({
          message: 'exportPurchasesToExcel: Error generating Excel export',
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

  // Helper method to generate empty Excel buffer when no data found
  private async generateEmptyExcelBuffer(
    workbook: any,
    worksheet: any,
    columns: any[],
  ): Promise<Buffer> {
    // Set columns
    worksheet.columns = columns.map((col) => ({
      key: col.key,
      width: col.width,
    }));

    // Add header
    worksheet.addRow(['No data found matching the specified filters']).font = {
      size: 14,
      bold: true,
    };
    worksheet.addRow(['Generated on:', new Date()]);
    worksheet.addRow([]);

    // Add empty table with headers
    const headerRow = worksheet.addRow(columns.map((col) => col.header));
    headerRow.eachCell((cell) => {
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFF' } },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '4F81BD' },
        } as any,
        border: {
          top: { style: 'thin' as any },
          left: { style: 'thin' as any },
          bottom: { style: 'thin' as any },
          right: { style: 'thin' as any },
        },
        alignment: { horizontal: 'center', vertical: 'middle' },
      };
    });

    return await workbook.xlsx.writeBuffer();
  }

  async getPendingPayments(
    page: number,
    limit: number,
    filters: {
      startDate?: Date | string;
      endDate?: Date | string;
      clientId?: string;
      productId?: string;
      type?: string;
    } = {},
  ): Promise<{
    data: {
      data: any[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
      total_amount: {
        total: number;
        new_order: number;
        customization: number;
        auditor_licence: number;
        amc: number;
      };
    };
  }> {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'getPendingPayments: Fetching pending payments',
          page,
          limit,
          filters,
        }),
      );

      const parsedStartDate = filters.startDate
        ? new Date(filters.startDate)
        : null;
      const parsedEndDate = filters.endDate
        ? new Date(filters.endDate)
        : null;

      // Parse type filter
      const allowedTypes = [
        'new_order',
        'customization',
        'auditor_licence',
        'amc',
      ];
      const typeFilter: string[] = filters.type
        ? filters.type.split(',').map((t) => t.trim().toLowerCase())
        : [];
      if (typeFilter.length > 0) {
        const invalid = typeFilter.filter((t) => !allowedTypes.includes(t));
        if (invalid.length > 0) {
          throw new HttpException(
            `Invalid type value(s): ${invalid.join(', ')}`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Get active order IDs (for filtering AMCs and checking order status)
      const activeOrders = await this.orderModel
        .find({ status: ORDER_STATUS_ENUM.ACTIVE })
        .distinct('_id');

      // Helper to safely convert any date-like to ISO string
      const toISO = (val: any): string | null => {
        if (!val) return null;
        return new Date(val).toISOString();
      };

      // Parse product filter
      let productObjectIds: Types.ObjectId[] | null = null;
      if (filters.productId) {
        const identifiers = filters.productId
          .split(',')
          .map((id) => id.trim());
        productObjectIds = [];
        const shortNames: string[] = [];
        for (const identifier of identifiers) {
          if (Types.ObjectId.isValid(identifier)) {
            productObjectIds.push(new Types.ObjectId(identifier));
          } else {
            shortNames.push(identifier);
          }
        }
        if (shortNames.length > 0) {
          const products = await this.productModel
            .find({ short_name: { $in: shortNames } })
            .select('_id')
            .lean<{ _id: Types.ObjectId }[]>();
          products.forEach((p) => productObjectIds!.push(p._id));
        }
      }

      // Build base query for orders
      const orderQuery: any = { status: ORDER_STATUS_ENUM.ACTIVE };
      if (filters.clientId) {
        orderQuery.client_id = new Types.ObjectId(filters.clientId);
      }
      if (productObjectIds) {
        orderQuery.products = { $in: productObjectIds };
      }

      // Fetch active orders with populations
      const orders = await this.orderModel
        .find(orderQuery)
        .sort({ createdAt: -1 })
        .populate([
          { path: 'client_id', select: 'name' },
          { path: 'products', select: 'short_name' },
        ])
        .lean();

      this.loggerService.log(
        JSON.stringify({
          message: 'getPendingPayments: Active orders fetched',
          count: orders.length,
        }),
      );

      const allRows: any[] = [];
      const orderClientMap = new Map<string, any>();

      // Process New Orders
      for (const order of orders) {
        const client = order.client_id as any;
        const clientName = client?.name || 'Unknown';
        const productNames = (order.products as any[])?.map(
          (p: any) => p.short_name,
        ) || [];
        const productIds = (order.products as any[])?.map(
          (p: any) => p._id?.toString(),
        ) || [];
        const orderId = order._id.toString();
        orderClientMap.set(orderId, {
          clientName,
          clientId: client?._id?.toString(),
          productNames,
          productIds,
        });

        if (!order.payment_terms || !Array.isArray(order.payment_terms))
          continue;

        for (let i = 0; i < order.payment_terms.length; i++) {
          const pt = order.payment_terms[i];
          if (
            pt.status === PAYMENT_STATUS_ENUM.PAID ||
            pt.status === PAYMENT_STATUS_ENUM.PROFORMA
          )
            continue;

          const rowDate = pt.invoice_date
            ? new Date(pt.invoice_date)
            : new Date(order.purchased_date);
          const dateInRange =
            (!parsedStartDate || rowDate >= parsedStartDate) &&
            (!parsedEndDate || rowDate <= parsedEndDate);

          if (!dateInRange) continue;

          allRows.push({
            _id: `new_order_${orderId}_${i}`,
            type: 'new_order',
            type_sub: pt.status === PAYMENT_STATUS_ENUM.INVOICE
              ? 'payment_term'
              : 'po_balance',
            client_id: client?._id?.toString(),
            client_name: clientName,
            product_ids: productIds,
            product_names: productNames,
            order_id: orderId,
            purchase_order_number: order.purchase_order_number,
            amount: pt.calculated_amount || 0,
            status: pt.status === PAYMENT_STATUS_ENUM.INVOICE
              ? 'invoice'
              : 'pending',
            invoice_date: pt.invoice_date
              ? toISO(pt.invoice_date)
              : toISO(order.purchased_date) || null,
            invoice_number: pt.invoice_number || null,
            entity_id: orderId,
          });
        }
      }

      // Process Customizations
      const customizationQuery: any = {
        payment_status: {
          $in: [PAYMENT_STATUS_ENUM.PENDING, PAYMENT_STATUS_ENUM.INVOICE],
        },
      };
      if (filters.clientId) {
        // Customizations don't have client_id directly, need to filter by order's client
        // We'll filter post-query
      }

      const customizations = await this.customizationModel
        .find(customizationQuery)
        .populate([
          { path: 'order_id', select: 'client_id products status purchased_date' },
        ])
        .lean();

      for (const cust of customizations) {
        const order = cust.order_id as any;
        if (!order || order.status !== ORDER_STATUS_ENUM.ACTIVE) continue;

        const orderId = order._id.toString();
        if (filters.clientId && order.client_id?.toString() !== filters.clientId)
          continue;
        if (
          productObjectIds &&
          !order.products?.some((pId: any) =>
            productObjectIds!.some(
              (fId) => fId.toString() === pId.toString(),
            ),
          )
        )
          continue;

        const rowDate = cust.invoice_date
          ? new Date(cust.invoice_date)
          : cust.purchased_date
            ? new Date(cust.purchased_date)
            : null;
        if (!rowDate) continue;
        const dateInRange =
          (!parsedStartDate || rowDate >= parsedStartDate) &&
          (!parsedEndDate || rowDate <= parsedEndDate);
        if (!dateInRange) continue;

        const existing = orderClientMap.get(orderId);
        const clientName = existing?.clientName || 'Unknown';
        const productNames = existing?.productNames || [];
        const productIds = existing?.productIds || [];

        allRows.push({
          _id: `customization_${cust._id}`,
          type: 'customization',
          client_id: order.client_id?.toString(),
          client_name: clientName,
          product_ids: productIds,
          product_names: productNames,
          order_id: orderId,
          purchase_order_number: cust.purchase_order_number,
          amount: cust.cost || 0,
          status:
            cust.payment_status === PAYMENT_STATUS_ENUM.INVOICE
              ? 'invoice'
              : 'pending',
          invoice_date: toISO(rowDate),
          invoice_number: cust.invoice_number || null,
          entity_id: cust._id.toString(),
        });
      }

      // Process Auditor Licences
      const licenseQuery: any = {
        payment_status: {
          $in: [PAYMENT_STATUS_ENUM.PENDING, PAYMENT_STATUS_ENUM.INVOICE],
        },
      };
      const licenses = await this.licenseModel
        .find(licenseQuery)
        .populate([
          { path: 'order_id', select: 'client_id products status purchased_date' },
        ])
        .lean();

      for (const lic of licenses) {
        const order = lic.order_id as any;
        if (!order || order.status !== ORDER_STATUS_ENUM.ACTIVE) continue;

        const orderId = order._id.toString();
        if (filters.clientId && order.client_id?.toString() !== filters.clientId)
          continue;
        if (
          productObjectIds &&
          !order.products?.some((pId: any) =>
            productObjectIds!.some(
              (fId) => fId.toString() === pId.toString(),
            ),
          )
        )
          continue;

        const rowDate = lic.invoice_date
          ? new Date(lic.invoice_date)
          : lic.purchase_date
            ? new Date(lic.purchase_date)
            : null;
        if (!rowDate) continue;
        const dateInRange =
          (!parsedStartDate || rowDate >= parsedStartDate) &&
          (!parsedEndDate || rowDate <= parsedEndDate);
        if (!dateInRange) continue;

        const existing = orderClientMap.get(orderId);
        const clientName = existing?.clientName || 'Unknown';
        const productNames = existing?.productNames || [];
        const productIds = existing?.productIds || [];
        const licenseAmount =
          (lic.rate?.amount || 0) * (lic.total_license || 0);

        allRows.push({
          _id: `auditor_licence_${lic._id}`,
          type: 'auditor_licence',
          client_id: order.client_id?.toString(),
          client_name: clientName,
          product_ids: productIds,
          product_names: productNames,
          order_id: orderId,
          purchase_order_number: lic.purchase_order_number,
          amount: licenseAmount,
          status:
            lic.payment_status === PAYMENT_STATUS_ENUM.INVOICE
              ? 'invoice'
              : 'pending',
          invoice_date: toISO(rowDate),
          invoice_number: lic.invoice_number || null,
          entity_id: lic._id.toString(),
        });
      }

      // Process AMCs
      const amcQuery: any = {
        payments: { $exists: true, $not: { $size: 0 } },
        order_id: { $in: activeOrders },
      };
      if (filters.clientId) {
        amcQuery.client_id = new Types.ObjectId(filters.clientId);
      }
      if (productObjectIds) {
        amcQuery.products = { $in: productObjectIds };
      }

      const amcs = await this.amcModel
        .find(amcQuery)
        .populate([
          { path: 'client_id', select: 'name' },
          { path: 'order_id', select: 'products' },
          { path: 'products', select: 'short_name' },
        ])
        .lean();

      for (const amc of amcs) {
        if (!amc.payments || !Array.isArray(amc.payments)) continue;

        const client = amc.client_id as any;
        const clientName = client?.name || 'Unknown';
        const order = amc.order_id as any;
        const orderId = order?._id?.toString();
        const amcProducts = (amc.products as any[])?.map(
          (p: any) => p.short_name,
        ) || [];
        const amcProductIds = (amc.products as any[])?.map(
          (p: any) => p._id?.toString(),
        ) || [];

        for (let i = 0; i < amc.payments.length; i++) {
          const payment = amc.payments[i];
          if (
            payment.status === PAYMENT_STATUS_ENUM.PAID ||
            payment.status === PAYMENT_STATUS_ENUM.PROFORMA
          )
            continue;

          const rowDate = payment.from_date
            ? new Date(payment.from_date)
            : null;
          if (!rowDate) continue;
          const dateInRange =
            (!parsedStartDate || rowDate >= parsedStartDate) &&
            (!parsedEndDate || rowDate <= parsedEndDate);
          if (!dateInRange) continue;

          allRows.push({
            _id: `amc_${amc._id}_${i}`,
            type: 'amc',
            client_id: client?._id?.toString(),
            client_name: clientName,
            product_ids: amcProductIds,
            product_names: amcProducts,
            order_id: orderId,
            purchase_order_number: payment.purchase_order_number,
            amount: payment.amc_rate_amount || 0,
            status:
              payment.status === PAYMENT_STATUS_ENUM.INVOICE
                ? 'invoice'
                : 'pending',
            invoice_date: toISO(payment.invoice_date || payment.from_date),
            invoice_number: payment.invoice_number || null,
            entity_id: amc._id.toString(),
          });
        }
      }

      // Filter by type
      let filteredRows = allRows;
      if (typeFilter.length > 0) {
        filteredRows = allRows.filter((row) => typeFilter.includes(row.type));
      }

      // Sort by invoice_date descending
      filteredRows.sort((a, b) => {
        const dateA = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
        const dateB = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
        return dateB - dateA;
      });

      // Calculate total amounts
      const totalAmount = {
        total: 0,
        invoice: 0,
        pending: 0,
        new_order: 0,
        customization: 0,
        auditor_licence: 0,
        amc: 0,
      };

      for (const row of filteredRows) {
        const amt = row.amount || 0;
        totalAmount.total += amt;
        if (row.status === 'invoice') totalAmount.invoice += amt;
        if (row.status === 'pending') totalAmount.pending += amt;
        if (row.type === 'new_order') totalAmount.new_order += amt;
        if (row.type === 'customization') totalAmount.customization += amt;
        if (row.type === 'auditor_licence') totalAmount.auditor_licence += amt;
        if (row.type === 'amc') totalAmount.amc += amt;
      }

      // Paginate
      const total = filteredRows.length;
      const totalPages = Math.ceil(total / limit);
      const startIdx = (page - 1) * limit;
      const paginatedRows = filteredRows.slice(startIdx, startIdx + limit);

      this.loggerService.log(
        JSON.stringify({
          message: 'getPendingPayments: Completed',
          totalRows: total,
          returnedRows: paginatedRows.length,
          totalAmount,
        }),
      );

      return {
        data: {
          pagination: {
            total,
            page,
            limit,
            pages: totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
          total_amount: totalAmount,
          data: paginatedRows,
        },
      };
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getPendingPayments: Error',
          error: error.message,
          stack: error.stack,
        }),
      );
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Failed to fetch pending payments: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async exportPendingPaymentsToExcel(
    filters: {
      startDate?: Date | string;
      endDate?: Date | string;
      clientId?: string;
      productId?: string;
      type?: string;
    } = {},
  ): Promise<Buffer> {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'exportPendingPaymentsToExcel: Generating Excel export',
          filters,
        }),
      );

      const columns = [
        { header: 'Sr. No.', key: 'srNo', width: 8 },
        { header: 'Client', key: 'client', width: 30 },
        { header: 'Type', key: 'type', width: 18 },
        { header: 'Products', key: 'products', width: 25 },
        { header: 'Invoice #', key: 'invoiceNumber', width: 20 },
        { header: 'Invoice Date', key: 'invoiceDate', width: 15 },
        { header: 'Amount', key: 'amount', width: 15 },
      ];

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Pending Payments Management';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('Pending Payments', {
        properties: { tabColor: { argb: '4F81BD' } },
        pageSetup: {
          paperSize: 9,
          orientation: 'landscape',
          fitToPage: true,
          fitToHeight: 0,
          fitToWidth: 1,
        },
      });

      // Fetch all pending payments (no pagination)
      const result = await this.getPendingPayments(1, 100000, filters);
      const allRows = result.data.data;

      if (allRows.length === 0) {
        return this.generateEmptyExcelBuffer(workbook, worksheet, columns);
      }

      // Add header row
      const headerRow = worksheet.addRow(columns.map((c) => c.header));
      headerRow.eachCell((cell) => {
        cell.style = {
          font: { bold: true, color: { argb: 'FFFFFF' }, size: 11 },
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4F81BD' },
          } as any,
          border: {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          },
          alignment: { horizontal: 'center', vertical: 'middle' },
        };
      });

      // Set column widths
      columns.forEach((col, idx) => {
        worksheet.getColumn(idx + 1).width = col.width;
      });

      // Add data rows
      const typeLabels: Record<string, string> = {
        new_order: 'New Order',
        customization: 'Customization',
        auditor_licence: 'Auditor Licence',
        amc: 'AMC',
      };

      allRows.forEach((row, index) => {
        const formattedDate = row.invoice_date
          ? new Date(row.invoice_date).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '—';

        worksheet.addRow([
          index + 1,
          row.client_name,
          typeLabels[row.type] || row.type,
          row.product_names?.join(', ') || '—',
          row.invoice_number || '—',
          formattedDate,
          row.amount || 0,
        ]);
      });

      // Format amount column
      const amountCol = worksheet.getColumn(7);
      amountCol.numFmt = '#,##0.00';

      const buffer = await workbook.xlsx.writeBuffer();

      this.loggerService.log(
        JSON.stringify({
          message:
            'exportPendingPaymentsToExcel: Excel export generated successfully',
          rowCount: allRows.length,
        }),
      );

      return buffer as any;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'exportPendingPaymentsToExcel: Error',
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
}
