import { PinoLogger } from 'nestjs-pino';
export declare class LoggerService {
    private readonly logger;
    readonly contextName: string;
    constructor(logger: PinoLogger);
    setContext(name: string): void;
    verbose(message: any, context?: string, ...args: any[]): void;
    debug(message: any, context?: string, ...args: any[]): void;
    trace(message: any, trace?: string, context?: string, ...args: any[]): void;
    log(message: any, context?: string, ...args: any[]): void;
    warn(message: any, context?: string, ...args: any[]): void;
    error(message: any, trace?: string, context?: string, ...args: any[]): void;
    eventInsights(name: string, properties: Record<string, unknown>): void;
    exception(error: Error, severity: number): void;
    metricInsights(name: string, value: number): void;
}
