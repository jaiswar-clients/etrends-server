export declare class CreateProductDto {
    name: string;
    short_name: string;
    does_have_license: boolean;
    modules: {
        name: string;
        key: string;
        description: string;
    }[];
    reports: {
        name: string;
        key: string;
        description: string;
    }[];
    description: string;
}
declare const UpdateProductDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreateProductDto>>;
export declare class UpdateProductDto extends UpdateProductDto_base {
}
export {};
