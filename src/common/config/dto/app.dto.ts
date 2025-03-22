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
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  INTERNAL_TEAM_EMAIL: string;

  @IsString()
  @IsNotEmpty()
  ENCRYPTION_KEY: string;

  @IsString()
  @IsNotEmpty()
  FILES_PATH: string;

  @IsString()
  @IsNotEmpty()
  IV: number;

  @IsString()
  @IsNotEmpty()
  CLIENT_URL: string;

  @IsString()
  @IsNotEmpty()
  APP_URL: string;

  @IsString()
  @IsNotEmpty()
  EMAIL_DOMAIN: string;

  @IsString()
  @IsNotEmpty()
  EMAIL_PORT: string;

  @IsNotEmpty()
  EMAIL_SECURE: boolean;

  @IsString()
  @IsNotEmpty()
  EMAIL_ID: string;

  @IsString()
  @IsNotEmpty()
  EMAIL_PASSWORD: string;

  TURN_OFF_EMAIL_REMINDER: boolean;
}
