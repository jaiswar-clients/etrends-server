import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
export declare class HttpExceptionInterceptor implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
}
