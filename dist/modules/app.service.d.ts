import { LoggerService } from '@/common/logger/services/logger.service';
import { StorageService } from '@/common/storage/services/storage.service';
export declare class AppService {
    private storageService;
    private loggerService;
    constructor(storageService: StorageService, loggerService: LoggerService);
    uploadFile(file: Express.Multer.File, fileName: string): Promise<string>;
    uploadFiles(files: Express.Multer.File[], fileNames: string[]): Promise<string[]>;
}
