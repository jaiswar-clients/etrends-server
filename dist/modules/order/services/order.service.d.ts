import { Customization, CustomizationDocument } from '@/db/schema/order/customization.schema';
import { License, LicenseDocument } from '@/db/schema/order/license.schema';
import { Order, OrderDocument } from '@/db/schema/order/product-order.schema';
import { SoftDeleteModel } from 'mongoose-delete';
import { CreateOrderDto } from '../dto/create-order.dto';
import { ProductDocument } from '@/db/schema/product.schema';
import { LoggerService } from '@/common/logger/services/logger.service';
import { Client, ClientDocument } from '@/db/schema/client.schema';
import { StorageService } from '@/common/storage/services/storage.service';
import { CreateLicenseDto } from '../dto/create-license.dto';
import { AdditionalService, AdditionalServiceDocument } from '@/db/schema/order/additional-service.schema';
import { CreateAdditionalServiceDto } from '../dto/create-additional-service.dto';
import { CreateCustomizationDto } from '../dto/create-customization.service.dto';
import { AMC_FILTER, ORDER_STATUS_ENUM, PURCHASE_TYPE } from '@/common/types/enums/order.enum';
import { AMC, AMCDocument, PAYMENT_STATUS_ENUM } from '@/db/schema/amc/amc.schema';
import { Types } from 'mongoose';
import { AddAMCPaymentDto, UpdateAMCPaymentDto } from '../dto/update-amc.dto';
import { IPendingPaymentTypes } from '../dto/update-pending-payment';
export declare class OrderService {
    private orderModel;
    private licenseModel;
    private customizationModel;
    private productModel;
    private clientModel;
    private additionalServiceModel;
    private amcModel;
    private loggerService;
    private storageService;
    constructor(orderModel: SoftDeleteModel<OrderDocument>, licenseModel: SoftDeleteModel<LicenseDocument>, customizationModel: SoftDeleteModel<CustomizationDocument>, productModel: SoftDeleteModel<ProductDocument>, clientModel: SoftDeleteModel<ClientDocument>, additionalServiceModel: SoftDeleteModel<AdditionalServiceDocument>, amcModel: SoftDeleteModel<AMCDocument>, loggerService: LoggerService, storageService: StorageService);
    createOrder(clientId: string, body: CreateOrderDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Order> & Order & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, Order> & Order & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateOrder(orderId: string, body: CreateOrderDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Order> & Order & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, Order> & Order & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    getOrderById(orderId: string): Promise<import("mongoose").Document<unknown, {}, Order> & Order & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    getOrdersByClientId(clientId: string): Promise<(import("mongoose").Document<unknown, {}, Order> & Order & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    addLicense(orderId: string, body: CreateLicenseDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, License> & License & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, License> & License & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    addAdditionalService(orderId: string, body: CreateAdditionalServiceDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, AdditionalService> & AdditionalService & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, AdditionalService> & AdditionalService & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    addCustomization(orderId: string, body: CreateCustomizationDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Customization> & Customization & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, Customization> & Customization & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    loadAllOrdersWithAttributes(page: number, limit: number): Promise<{
        purchases: ({
            client: Types.ObjectId | {
                name: string;
            };
            purchase_type: PURCHASE_TYPE;
            products: Types.ObjectId[];
            status: ORDER_STATUS_ENUM;
            amc_start_date: Date;
            id: unknown;
        } | {
            client: (import("mongoose").Document<unknown, {}, Client> & Client & Required<{
                _id: unknown;
            }> & {
                __v: number;
            }) | {
                name: string;
            };
            purchase_type: PURCHASE_TYPE;
            products: {
                name: any;
            }[];
            status: any;
            id: any;
        })[];
    }>;
    getAmcByOrderId(orderId: string): Promise<import("mongoose").Document<unknown, {}, AMC> & AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateAmcPaymentById(id: string, paymentId: string, body: UpdateAMCPaymentDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, AMC> & AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, AMC> & AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    getLicenseById(id: string): Promise<import("mongoose").Document<unknown, {}, License> & License & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    getAdditionalServiceById(id: string): Promise<import("mongoose").Document<unknown, {}, AdditionalService> & AdditionalService & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    getCustomizationById(id: string): Promise<import("mongoose").Document<unknown, {}, Customization> & Customization & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateAdditionalServiceById(id: string, body: CreateAdditionalServiceDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, AdditionalService> & AdditionalService & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, AdditionalService> & AdditionalService & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateCustomizationById(id: string, body: CreateCustomizationDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Customization> & Customization & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, Customization> & Customization & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateLicenseById(id: string, body: CreateLicenseDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, License> & License & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, License> & License & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    loadAllAMC(page: number, limit: number, filter: AMC_FILTER, options?: {
        upcoming: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<{
        data: {
            pagination: {
                total: number;
                page: number;
                limit: number;
                pages: number;
            };
            data: any[];
        };
    }>;
    private getNextDate;
    updateAMCPayments(): Promise<{
        processed: number;
        updated: number;
        skipped: number;
        errors: number;
        newPaymentsAdded: number;
    }>;
    getAllPendingPayments(page?: number, limit?: number): Promise<{
        pending_payments: {
            [key: string]: any;
            _id: string;
            type: "amc" | "order" | "license" | "customization" | "additional_service";
            status: string;
            pending_amount: number;
            payment_identifier?: string | number;
            client_name?: string;
            product_name?: string;
        }[];
        pagination: {
            total: number;
            currentPage: number;
            totalPages: number;
            limit: number;
            hasNextPage: boolean;
            hasPreviousPage: boolean;
        };
    }>;
    updatePendingPayment(id: string, type: IPendingPaymentTypes, payment_identifier: string | number, updateData: {
        status: PAYMENT_STATUS_ENUM;
        payment_receive_date: string;
    }): Promise<any>;
    getAmcReviewByOrderId(orderId: string): Promise<{
        from_date: Date;
        is_free_amc: boolean;
        to_date: Date;
        status: PAYMENT_STATUS_ENUM;
        amc_rate_applied: number;
        amc_rate_amount: number;
        amc_frequency: number;
        total_cost: number;
    }[]>;
    addPaymentsIntoAmc(amcId: string, payments: AddAMCPaymentDto[]): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, AMC> & AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, AMC> & AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    deleteAllOrdersForAllClients(): Promise<{
        message: string;
    }>;
    migrateOrderData(): Promise<void>;
    removeClientsData(): Promise<{
        message: string;
        status: string;
    }>;
}
