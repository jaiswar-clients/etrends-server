import { Types } from 'mongoose';
import { ORDER_STATUS_ENUM } from '@/common/types/enums/order.enum';
declare class PaymentTermsDto {
    name: string;
    percentage_from_base_cost: number;
    calculated_amount: number;
    date: Date;
}
declare class LicenseDetailsDto {
    cost_per_license: number;
    total_license: number;
}
declare class AmcRateDto {
    percentage: number;
    amount: number;
}
declare class CustomizationDto {
    cost: number;
    modules: string[];
}
export declare class CreateOrderDto {
    products: Types.ObjectId[];
    other_document: {
        title: string;
        url: string;
    };
    base_cost: number;
    amc_rate: AmcRateDto;
    status: ORDER_STATUS_ENUM;
    purchased_date: string;
    payment_terms: PaymentTermsDto[];
    base_cost_seperation: {
        product_id: Types.ObjectId;
        amount: number;
        percentage: number;
    }[];
    agreements: {
        start: Date;
        end: Date;
        document: string;
    }[];
    invoice_document: string;
    purchase_order_document: string;
    amc_start_date: Date;
    license_details: LicenseDetailsDto;
    customization: CustomizationDto;
}
export {};
