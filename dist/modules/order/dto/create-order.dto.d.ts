import { Types } from 'mongoose';
import { ORDER_STATUS_ENUM } from '@/common/types/enums/order.enum';
import { PAYMENT_STATUS_ENUM } from '@/db/schema/order/product-order.schema';
declare class PaymentTermsDto {
    name: string;
    percentage_from_base_cost: number;
    calculated_amount: number;
    status: PAYMENT_STATUS_ENUM;
    payment_receive_date: Date;
    invoice_document: string;
    invoice_number: string;
    invoice_date: string;
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
    other_documents: {
        title: string;
        url: string;
    }[];
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
    purchase_order_document: string;
    purchase_order_number: string;
    amc_start_date: Date;
    cost_per_license: number;
    licenses_with_base_price: number;
    customization: CustomizationDto;
}
export {};
