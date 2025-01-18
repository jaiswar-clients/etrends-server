import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.string(),
  NODE_ENV: Joi.string().valid('local', 'development', 'production', 'test'),
  DATABASE_URL: Joi.string().required(),
  CLIENT_URL: Joi.string().required(),
  APP_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  ENCRYPTION_KEY: Joi.string().required(),
  IV: Joi.string().required(),
  FILES_PATH: Joi.string().required(),

  EMAIL_DOMAIN: Joi.string().required(),
  EMAIL_PORT: Joi.string().required(),
  EMAIL_SECURE: Joi.boolean().required(),
  EMAIL_ID: Joi.string().required(),
  EMAIL_PASSWORD: Joi.string().required(),
});
