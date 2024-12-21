import { OrderService } from '../services/order.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { CreateLicenseDto } from '../dto/create-license.dto';
import { CreateAdditionalServiceDto } from '../dto/create-additional-service.dto';
import { CreateCustomizationDto } from '../dto/create-customization.service.dto';
import { UpdateAMCDto } from '../dto/update-amc.dto';
import { AMC_FILTER } from '@/common/types/enums/order.enum';
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
    loadAllAMC(page: number, filter: AMC_FILTER, limit: number, upcoming: string): Promise<any[]>;
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
    updateAMC(orderId: string, body: UpdateAMCDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/amc/amc.schema").AMC> & import("../../../db/schema/amc/amc.schema").AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/amc/amc.schema").AMC> & import("../../../db/schema/amc/amc.schema").AMC & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
}
