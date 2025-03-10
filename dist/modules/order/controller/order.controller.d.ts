import { OrderService } from '../services/order.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { CreateLicenseDto } from '../dto/create-license.dto';
import { CreateAdditionalServiceDto } from '../dto/create-additional-service.dto';
import { CreateCustomizationDto } from '../dto/create-customization.service.dto';
import { AddAMCPaymentDto, UpdateAMCDto, UpdateAMCPaymentDto } from '../dto/update-amc.dto';
import { AMC_FILTER } from '@/common/types/enums/order.enum';
import { UpdatePendingPaymentDto } from '../dto/update-pending-payment';
export type UpdateOrderType = CreateOrderDto;
export declare class OrderController {
    private orderService;
    constructor(orderService: OrderService);
    loadAllOrdersWithAttributes(page: number, limit: number): Promise<{
        purchases: ({
            client: import("mongoose").Types.ObjectId | {
                name: string;
            };
            purchase_type: import("@/common/types/enums/order.enum").PURCHASE_TYPE;
            products: import("mongoose").Types.ObjectId[];
            status: import("@/common/types/enums/order.enum").ORDER_STATUS_ENUM;
            amc_start_date: Date;
            id: unknown;
        } | {
            client: (import("mongoose").Document<unknown, {}, import("../../../db/schema/client.schema").Client> & import("../../../db/schema/client.schema").Client & Required<{
                _id: unknown;
            }> & {
                __v: number;
            }) | {
                name: string;
            };
            purchase_type: import("@/common/types/enums/order.enum").PURCHASE_TYPE;
            products: {
                name: any;
            }[];
            status: any;
            id: any;
        })[];
    }>;
    loadAllAMC(page: number, limit: number, filter: AMC_FILTER, upcoming: string, startDate: string, endDate: string): Promise<any>;
    getAllPendingPayments(page: number, limit: number): Promise<{
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
    getOrderById(orderId: string): Promise<import("mongoose").Document<unknown, {}, import("../../../db/schema/order/product-order.schema").Order> & import("../../../db/schema/order/product-order.schema").Order & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    getAMCByOrderId(orderId: string): Promise<import("mongoose").Document<unknown, {}, import("../../../db/schema/amc/amc.schema").AMC> & import("../../../db/schema/amc/amc.schema").AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    getOrdersByClientId(clientId: string): Promise<(import("mongoose").Document<unknown, {}, import("../../../db/schema/order/product-order.schema").Order> & import("../../../db/schema/order/product-order.schema").Order & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    getLicenseById(orderId: string): Promise<import("mongoose").Document<unknown, {}, import("../../../db/schema/order/license.schema").License> & import("../../../db/schema/order/license.schema").License & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    getAdditionalServiceById(orderId: string): Promise<import("mongoose").Document<unknown, {}, import("../../../db/schema/order/additional-service.schema").AdditionalService> & import("../../../db/schema/order/additional-service.schema").AdditionalService & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    getCustomizationById(orderId: string): Promise<import("mongoose").Document<unknown, {}, import("../../../db/schema/order/customization.schema").Customization> & import("../../../db/schema/order/customization.schema").Customization & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    getAmcReviewByOrderId(orderId: string): Promise<{
        from_date: Date;
        to_date: Date;
        status: import("../../../db/schema/amc/amc.schema").PAYMENT_STATUS_ENUM;
        amc_rate_applied: number;
        amc_rate_amount: number;
        amc_frequency: number;
        total_cost: number;
    }[]>;
    createOrder(clientId: string, body: CreateOrderDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/order/product-order.schema").Order> & import("../../../db/schema/order/product-order.schema").Order & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/order/product-order.schema").Order> & import("../../../db/schema/order/product-order.schema").Order & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateOrder(id: string, body: UpdateOrderType): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/order/product-order.schema").Order> & import("../../../db/schema/order/product-order.schema").Order & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/order/product-order.schema").Order> & import("../../../db/schema/order/product-order.schema").Order & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    addLicense(orderId: string, body: CreateLicenseDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/order/license.schema").License> & import("../../../db/schema/order/license.schema").License & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/order/license.schema").License> & import("../../../db/schema/order/license.schema").License & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    addAdditionalService(orderId: string, body: CreateAdditionalServiceDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/order/additional-service.schema").AdditionalService> & import("../../../db/schema/order/additional-service.schema").AdditionalService & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/order/additional-service.schema").AdditionalService> & import("../../../db/schema/order/additional-service.schema").AdditionalService & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    addCustomization(orderId: string, body: CreateCustomizationDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/order/customization.schema").Customization> & import("../../../db/schema/order/customization.schema").Customization & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/order/customization.schema").Customization> & import("../../../db/schema/order/customization.schema").Customization & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateCustomizationById(id: string, body: CreateCustomizationDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/order/customization.schema").Customization> & import("../../../db/schema/order/customization.schema").Customization & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/order/customization.schema").Customization> & import("../../../db/schema/order/customization.schema").Customization & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateLicenseById(id: string, body: CreateLicenseDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/order/license.schema").License> & import("../../../db/schema/order/license.schema").License & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/order/license.schema").License> & import("../../../db/schema/order/license.schema").License & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateAdditionalServiceById(id: string, body: CreateAdditionalServiceDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/order/additional-service.schema").AdditionalService> & import("../../../db/schema/order/additional-service.schema").AdditionalService & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/order/additional-service.schema").AdditionalService> & import("../../../db/schema/order/additional-service.schema").AdditionalService & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateAMCById(id: string, body: UpdateAMCDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/amc/amc.schema").AMC> & import("../../../db/schema/amc/amc.schema").AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/amc/amc.schema").AMC> & import("../../../db/schema/amc/amc.schema").AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    addPaymentsIntoAMC(amcId: string, body: AddAMCPaymentDto[]): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/amc/amc.schema").AMC> & import("../../../db/schema/amc/amc.schema").AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/amc/amc.schema").AMC> & import("../../../db/schema/amc/amc.schema").AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateAMCPaymentById(id: string, paymentId: string, body: UpdateAMCPaymentDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/amc/amc.schema").AMC> & import("../../../db/schema/amc/amc.schema").AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/amc/amc.schema").AMC> & import("../../../db/schema/amc/amc.schema").AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updatePendingPaymentStatus(id: string, body: UpdatePendingPaymentDto): Promise<any>;
}
