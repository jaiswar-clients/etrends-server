"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
let LoggerService = class LoggerService {
    constructor(logger) {
        this.logger = logger;
        this.contextName = 'context';
    }
    setContext(name) {
        this.logger.setContext(name);
    }
    verbose(message, context, ...args) {
        if (context) {
            this.logger.info({ [this.contextName]: context }, message, ...args);
        }
        else {
            this.logger.info(message, ...args);
        }
    }
    debug(message, context, ...args) {
        if (context) {
            this.logger.debug({ [this.contextName]: context }, message, ...args);
        }
        else {
            this.logger.debug(message, ...args);
        }
    }
    trace(message, trace, context, ...args) {
        if (context) {
            this.logger.trace({ [this.contextName]: context, trace }, message, ...args);
        }
        else if (trace) {
            this.logger.trace({ trace }, message, ...args);
        }
        else {
            this.logger.trace(message, ...args);
        }
    }
    log(message, context, ...args) {
        if (context) {
            this.logger.info({ [this.contextName]: context }, message, ...args);
        }
        else {
            this.logger.info(message, ...args);
        }
    }
    warn(message, context, ...args) {
        if (context) {
            this.logger.warn({ [this.contextName]: context }, message, ...args);
        }
        else {
            this.logger.warn(message, ...args);
        }
    }
    error(message, trace, context, ...args) {
        if (context) {
            this.logger.error({ [this.contextName]: context, trace }, message, ...args);
        }
        else if (trace) {
            this.logger.error({ trace }, message, ...args);
        }
        else {
            this.logger.error(message, ...args);
        }
    }
    eventInsights(name, properties) {
        this.logger.info({ name, properties });
    }
    exception(error, severity) {
        this.logger.fatal({ exception: error, severity });
    }
    metricInsights(name, value) {
        this.logger.info({ name, value });
    }
};
exports.LoggerService = LoggerService;
exports.LoggerService = LoggerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nestjs_pino_1.PinoLogger])
], LoggerService);
//# sourceMappingURL=logger.service.js.map