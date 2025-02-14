"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const config_1 = require("@nestjs/config");
exports.app = (0, config_1.registerAs)('APP', () => ({
    DATABASE_URL: process.env['DATABASE_URL'],
    PORT: process.env['PORT'],
    JWT_SECRET: process.env['JWT_SECRET'],
    INTERNAL_TEAM_EMAIL: process.env['INTERNAL_TEAM_EMAIL'],
    IV: process.env['IV'],
    ENCRYPTION_KEY: process.env['ENCRYPTION_KEY'],
    FILES_PATH: process.env['FILES_PATH'],
    CLIENT_URL: process.env['CLIENT_URL'],
    APP_URL: process.env['APP_URL'],
    EMAIL_DOMAIN: process.env['EMAIL_DOMAIN'],
    EMAIL_PORT: process.env['EMAIL_PORT'],
    EMAIL_SECURE: process.env['EMAIL_SECURE'],
    EMAIL_ID: process.env['EMAIL_ID'],
    EMAIL_PASSWORD: process.env['EMAIL_PASSWORD'],
}));
//# sourceMappingURL=index.js.map