import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AppConfigDTO {
  @IsString()
  @IsNotEmpty()
  NODE_ENV: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsNumber()
  @IsNotEmpty()
  PORT: number;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: number;

  @IsString()
  @IsNotEmpty()
  ENCRYPTION_KEY: number;

  @IsString()
  @IsNotEmpty()
  IV: number;

  @IsString()
  @IsNotEmpty()
  CLIENT_URL: number;

  @IsString()
  @IsNotEmpty()
  APP_URL: number;
}
