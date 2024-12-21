"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationSchema = void 0;
const Joi = require("joi");
exports.validationSchema = Joi.object({
    PORT: Joi.string(),
    NODE_ENV: Joi.string().valid('local', 'development', 'production', 'test'),
    DATABASE_URL: Joi.string().required(),
    CLIENT_URL: Joi.string().required(),
    APP_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().required(),
    ENCRYPTION_KEY: Joi.string().required(),
    IV: Joi.string().required(),
    AWS_CLOUDFRONT_DISTRIBUTION: Joi.string().required(),
    AWS_SECRET_ACCESS_KEY: Joi.string().required(),
    AWS_ACCESS_KEY_ID: Joi.string().required(),
    AWS_CLOUDFRONT_PRIVATE_KEY: Joi.string().required(),
    AWS_CLOUDFRONT_KEY_PAIR: Joi.string().required(),
    AWS_REGION: Joi.string().required(),
    AWS_BUCKET_NAME: Joi.string().required(),
    EMAIL_DOMAIN: Joi.string().required(),
    EMAIL_PORT: Joi.string().required(),
    EMAIL_SECURE: Joi.boolean().required(),
    EMAIL_ID: Joi.string().required(),
    EMAIL_PASSWORD: Joi.string().required(),
});
//# sourceMappingURL=config.validation.js.map