import { IsString, IsOptional, IsArray } from 'class-validator';

export class CancelOrderDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cancelled_products?: string[];
}
