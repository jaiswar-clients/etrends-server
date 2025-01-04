import { PAYMENT_STATUS_ENUM } from '@/db/schema/amc/amc.schema';
export declare class UpdateAMCDto {
    purchase_order_number?: string;
    payments?: {
        from_date: Date;
        to_date: Date;
        status: PAYMENT_STATUS_ENUM;
        received_date: Date;
    }[];
    purchase_order_document?: string;
    invoice_document?: string;
    start_date: string;
}
