import { ClientService } from '../services/client.service';
import { CreateNewClientDto } from '../dto/create-client.dto';
export declare class ClientController {
    private clientService;
    constructor(clientService: ClientService);
    getAllClients(page: string, limit: string, all: string): Promise<any>;
    getAllParentCompanies(): Promise<(import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/client.schema").Client> & import("../../../db/schema/client.schema").Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/client.schema").Client> & import("../../../db/schema/client.schema").Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    getProductsPurchasedByClient(clientId: string): Promise<any[]>;
    getProfitByClient(clientId: string): Promise<{
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
    getClientById(id: string): Promise<import("mongoose").Document<unknown, {}, import("../../../db/schema/client.schema").Client> & import("../../../db/schema/client.schema").Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    createNewClient(body: CreateNewClientDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/client.schema").Client> & import("../../../db/schema/client.schema").Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/client.schema").Client> & import("../../../db/schema/client.schema").Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateClient(dbClientId: string, body: CreateNewClientDto): Promise<import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/client.schema").Client> & import("../../../db/schema/client.schema").Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/client.schema").Client> & import("../../../db/schema/client.schema").Client & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
}
