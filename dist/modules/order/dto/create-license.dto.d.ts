import { Types } from 'mongoose';
export declare class CreateLicenseDto {
    product_id: Types.ObjectId;
    cost_per_license: number;
    total_license: number;
    purchase_date: string;
    purchase_order_document: string;
    invoice: string;
}
