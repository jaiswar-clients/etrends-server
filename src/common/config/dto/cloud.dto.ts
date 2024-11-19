import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CloudDTO {

  @IsString()
  @IsNotEmpty()
  AWS_CLOUDFRONT_DISTRIBUTION: string;

  @IsString()
  @IsNotEmpty()
  AWS_ACCESS_KEY_ID: string;

  @IsString()
  @IsNotEmpty()
  AWS_SECRET_ACCESS_KEY: string;

  @IsString()
  @IsNotEmpty()
  AWS_CLOUDFRONT_KEY_PAIR: string;

  @IsString()
  @IsNotEmpty()
  AWS_CLOUDFRONT_PRIVATE_KEY: string;

  @IsString()
  @IsNotEmpty()
  AWS_REGION: string;

  @IsString()
  @IsNotEmpty()
  AWS_BUCKET_NAME: string;
}
