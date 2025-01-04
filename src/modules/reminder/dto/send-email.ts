import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendEmailDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsEmail()
  @IsNotEmpty()
  from: string;

  @IsEmail()
  @IsNotEmpty()
  to: string;

  @IsOptional()
  bcc?: string;

  @IsOptional()
  cc?: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  order_id?: string;

  @IsOptional()
  @IsString()
  amc_id?: string;

  @IsOptional()
  @IsString()
  license_id?: string;

  @IsOptional()
  @IsString()
  customization_id?: string;

  @IsString()
  email_template_id: string; // if the communication is external we can track the email template used
}
