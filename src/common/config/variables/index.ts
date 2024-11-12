import { registerAs } from '@nestjs/config';

export const app = registerAs('APP', () => ({
  DATABASE_URL: process.env['DATABASE_URL'],
  PORT: process.env['PORT'],
  JWT_SECRET: process.env['JWT_SECRET'],
  IV: process.env['IV'],
  ENCRYPTION_KEY: process.env['ENCRYPTION_KEY'],
  CLIENT_URL: process.env['CLIENT_URL'],
  APP_URL: process.env['APP_URL'],
}));

