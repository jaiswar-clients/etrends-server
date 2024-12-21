import { AxiosRequestConfig } from 'axios';
import { HttpService as NestHttpService } from '@nestjs/axios';
export declare class HttpService extends NestHttpService {
    constructor(config: AxiosRequestConfig<any>);
}
