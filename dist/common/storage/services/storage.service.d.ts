import { ConfigService } from '@/common/config/services/config.service';
import { LoggerService } from '@/common/logger/services/logger.service';
export declare class StorageService {
    private configService;
    private loggerService;
    private readonly filesPath;
    constructor(configService: ConfigService, loggerService: LoggerService);
    get(filename: string): string;
    uploadFile(file: Express.Multer.File, fileName: string): Promise<string>;
}
