import { ConfigService } from '@/common/config/services/config.service';
import { LoggerService } from '@/common/logger/services/logger.service';
export declare class StorageService {
    private configService;
    private loggerService;
    private readonly s3;
    constructor(configService: ConfigService, loggerService: LoggerService);
    get(filename: string): string;
    generateUploadUrl(fileName: string): Promise<string>;
}
