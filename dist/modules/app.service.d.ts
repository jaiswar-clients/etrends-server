import { LoggerService } from '@/common/logger/services/logger.service';
import { StorageService } from '@/common/storage/services/storage.service';
export declare class AppService {
    private storageService;
    private loggerService;
    constructor(storageService: StorageService, loggerService: LoggerService);
    getUrlForUpload(fileName: string): Promise<string>;
}
