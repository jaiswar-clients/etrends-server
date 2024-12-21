import { INDUSTRIES_ENUM } from '@/common/types/enums/industry.enum';
declare class PointOfContactDto {
    name: string;
    email: string;
    designation?: string;
    phone?: string;
    opt_for_email_reminder?: boolean;
}
export declare class CreateNewClientDto {
    name: string;
    amc_frequency_in_months?: number;
    parent_company?: {
        id: string;
        new: boolean;
        name: string;
    };
    pan_number?: string;
    gst_number?: string;
    address?: string;
    industry?: INDUSTRIES_ENUM;
    client_id?: string;
    vendor_id?: string;
    point_of_contacts?: PointOfContactDto[];
    orders?: any[];
}
export {};
