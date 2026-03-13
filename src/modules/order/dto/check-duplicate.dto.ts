import { IsArray, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export type PurchaseType = 'order' | 'license' | 'customization' | 'additional-service';

export class CheckDuplicateDto {
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsEnum(['order', 'license', 'customization', 'additional-service'])
  @IsString()
  @IsNotEmpty()
  purchaseType: PurchaseType;

  @IsString()
  @IsOptional()
  purchaseOrderNumber?: string;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  productIds?: string[];

  @IsMongoId()
  @IsString()
  @IsOptional()
  productId?: string;
}
