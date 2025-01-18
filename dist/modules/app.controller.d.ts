import { AppService } from './app.service';
declare class UploadFileDto {
    filename: string;
}
declare class UploadMultipleFilesDto {
    filenames: string[];
}
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    uploadFile(file: Express.Multer.File, body: UploadFileDto): Promise<string>;
    uploadMultipleFiles(files: Express.Multer.File[], body: UploadMultipleFilesDto): Promise<string[]>;
}
export {};
