import { Types } from 'mongoose';
import { ORDER_STATUS_ENUM } from '@/common/types/enums/order.enum';
import {
    IsArray,
    IsDate,
    IsEnum,
    IsMongoId,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PaymentTermsDto {
    @IsString()
    name: string;

    @IsNumber()
    percentage_from_base_cost: number;

    @IsNumber()
    calculated_amount: number;

    @IsString()
    date: Date;
}

class LicenseDetailsDto {
    @IsNumber()
    cost_per_license: number;

    @IsNumber()
    total_license: number;
}

class AmcRateDto {
    @IsNumber()
    percentage: number;

    @IsNumber()
    amount: number;
}

export class CreateNewOrderDto {
    @IsArray()
    @IsMongoId({ each: true })
    @IsNotEmpty()
    products: Types.ObjectId[];

    @IsNumber()
    base_cost: number;

    @ValidateNested()
    @Type(() => AmcRateDto)
    amc_rate: AmcRateDto;

    @IsEnum(ORDER_STATUS_ENUM)
    status: ORDER_STATUS_ENUM;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PaymentTermsDto)
    payment_terms: PaymentTermsDto[];

    @IsString()
    @IsOptional()
    agreement_document: string;

    @IsString()
    @IsOptional()
    agreement_date: {
        start: Date;
        end: Date;
    };

    @IsString()
    @IsOptional()
    purchase_order_document: string;

    @IsNumber()
    @IsOptional()
    training_implementation_cost: string;

    @IsString()
    @IsOptional()
    deployment_date: Date;

    @ValidateNested()
    @Type(() => LicenseDetailsDto)
    @IsOptional()
    license_details?: LicenseDetailsDto;
}
