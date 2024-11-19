import { IsString, IsBoolean, IsNotEmpty } from 'class-validator';


export class CreateProductDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    short_name: string;

    @IsBoolean()
    does_have_license: boolean;

    @IsString()
    @IsNotEmpty()
    description: string;
}