export declare const app: (() => {
    DATABASE_URL: string;
    PORT: string;
    JWT_SECRET: string;
    IV: string;
    ENCRYPTION_KEY: string;
    CLIENT_URL: string;
    APP_URL: string;
    EMAIL_DOMAIN: string;
    EMAIL_PORT: string;
    EMAIL_SECURE: string;
    EMAIL_ID: string;
    EMAIL_PASSWORD: string;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    DATABASE_URL: string;
    PORT: string;
    JWT_SECRET: string;
    IV: string;
    ENCRYPTION_KEY: string;
    CLIENT_URL: string;
    APP_URL: string;
    EMAIL_DOMAIN: string;
    EMAIL_PORT: string;
    EMAIL_SECURE: string;
    EMAIL_ID: string;
    EMAIL_PASSWORD: string;
}>;
export declare const awsServices: (() => {
    AWS_SECRET_ACCESS_KEY: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_CLOUDFRONT_KEY_PAIR: string;
    AWS_CLOUDFRONT_PRIVATE_KEY: string;
    AWS_CLOUDFRONT_DISTRIBUTION: string;
    AWS_BUCKET_NAME: string;
    AWS_REGION: string;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    AWS_SECRET_ACCESS_KEY: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_CLOUDFRONT_KEY_PAIR: string;
    AWS_CLOUDFRONT_PRIVATE_KEY: string;
    AWS_CLOUDFRONT_DISTRIBUTION: string;
    AWS_BUCKET_NAME: string;
    AWS_REGION: string;
}>;
