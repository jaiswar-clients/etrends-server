import { Client, ClientDocument } from '@/db/schema/client.schema';
import { SoftDeleteModel } from 'mongoose-delete';
import { CreateNewClientDto } from '../dto/create-client.dto';
import { LoggerService } from '@/common/logger/services/logger.service';
import { OrderDocument } from '@/db/schema/order/product-order.schema';
export declare class ClientService {
    private clientModel;
    private orderModel;
    private loggerService;
    constructor(clientModel: SoftDeleteModel<ClientDocument>, orderModel: SoftDeleteModel<OrderDocument>, loggerService: LoggerService);
    getAllClients(page?: number, limit?: number, fetchAll?: boolean): Promise<any>;
    getAllParentCompanies(): Promise<(import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Client> & Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, Client> & Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    getClientById(id: string): Promise<import("mongoose").Document<unknown, {}, Client> & Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    createClient(body: CreateNewClientDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Client> & Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, Client> & Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateClient(dbClientId: string, body: CreateNewClientDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, Client> & Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, Client> & Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    getProductsPurchasedByClient(clientId: string): Promise<any[]>;
    getProfitFromClient(clientId: string): Promise<{
        total_profit: number;
        upcoming_amc_profit: number;
        total_amc_collection: number;
        revenue_breakdown: {
            base_cost: number;
            customizations: number;
            licenses: number;
            additional_services: number;
            amc: number;
        };
        currency: string;
        orders: {
            id: unknown;
            products: import("mongoose").Types.ObjectId[];
            base_cost: number;
            customizations: import("mongoose").Types.ObjectId[];
            licenses: import("mongoose").Types.ObjectId[];
            additional_services: import("mongoose").Types.ObjectId[];
            amc_details: import("mongoose").Types.ObjectId;
            agreements: {
                _id: any;
                start: Date;
                end: Date;
                document: string;
            }[];
            status: import("../../../common/types/enums/order.enum").ORDER_STATUS_ENUM;
            purchased_date: Date;
        }[];
    }>;
}
