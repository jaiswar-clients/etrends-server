import { registerAs } from '@nestjs/config';

export const app = registerAs('APP', () => ({
  DATABASE_URL: process.env['DATABASE_URL'],
  PORT: process.env['PORT'],
  JWT_SECRET: process.env['JWT_SECRET'],
  IV: process.env['IV'],
  ENCRYPTION_KEY: process.env['ENCRYPTION_KEY'],
  CLIENT_URL: process.env['CLIENT_URL'],
  APP_URL: process.env['APP_URL'],
  EMAIL_DOMAIN: process.env['EMAIL_DOMAIN'],
  EMAIL_PORT: process.env['EMAIL_PORT'],
  EMAIL_SECURE: process.env['EMAIL_SECURE'],
  EMAIL_ID: process.env['EMAIL_ID'],
  EMAIL_PASSWORD: process.env['EMAIL_PASSWORD'],
}));

export const awsServices = registerAs('AWS', () => ({
  AWS_SECRET_ACCESS_KEY: process.env['AWS_SECRET_ACCESS_KEY'],
  AWS_ACCESS_KEY_ID: process.env['AWS_ACCESS_KEY_ID'],
  AWS_CLOUDFRONT_KEY_PAIR: process.env['AWS_SECRET_ACCESS_KEY'],
  AWS_CLOUDFRONT_PRIVATE_KEY: process.env['AWS_ACCESS_KEY_ID'],
  AWS_CLOUDFRONT_DISTRIBUTION: process.env['AWS_CLOUDFRONT_DISTRIBUTION'],
  AWS_BUCKET_NAME: process.env['AWS_CLOUDFRONT_DISTRIBUTION'],
  AWS_REGION: process.env['AWS_CLOUDFRONT_DISTRIBUTION'],
}));
