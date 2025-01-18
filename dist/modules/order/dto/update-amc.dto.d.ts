import { PAYMENT_STATUS_ENUM } from '@/db/schema/amc/amc.schema';
export declare class UpdateAMCDto {
    payments?: {
        from_date: Date;
        to_date: Date;
        status: PAYMENT_STATUS_ENUM;
        received_date: Date;
        purchase_order_number?: string;
        purchase_order_document?: string;
        purchase_order_date?: Date;
        invoice_document?: string;
        invoice_number?: string;
        invoice_date?: Date;
    }[];
    start_date: string;
}
