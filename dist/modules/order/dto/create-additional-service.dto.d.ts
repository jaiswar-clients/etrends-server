import { Types } from 'mongoose';
declare class DateRange {
    start: Date;
    end: Date;
}
export declare class CreateAdditionalServiceDto {
    product_id: Types.ObjectId;
    name: string;
    date: DateRange;
    invoice_document: string;
    cost: number;
    purchase_order_document?: string;
    service_document?: string;
}
export {};
