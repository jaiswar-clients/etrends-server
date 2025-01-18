import { LoggerService } from '@/common/logger/services/logger.service';
import { StorageService } from '@/common/storage/services/storage.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(
    private storageService: StorageService,
    private loggerService: LoggerService,
  ) {}

  async uploadFile(file: Express.Multer.File, fileName: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'uploadFile: Start uploading file',
          fileName,
        }),
      );

      const filePath = await this.storageService.uploadFile(file, fileName);

      this.loggerService.log(
        JSON.stringify({
          message: 'uploadFile: Successfully uploaded file',
          fileName,
          filePath,
        }),
      );

      return filePath;
    } catch (error: any) {
      console.log(error);
      this.loggerService.log(
        JSON.stringify({
          message: 'uploadFile: Error uploading file',
          fileName,
          error: error.message,
        }),
      );

      throw new HttpException('Server failed', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }

  async uploadFiles(files: Express.Multer.File[], fileNames: string[]) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'uploadFiles: Start uploading multiple files',
          fileNames,
        }),
      );

      const filePaths = await Promise.all(
        files.map((file, index) =>
          this.storageService.uploadFile(file, fileNames[index]),
        ),
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'uploadFiles: Successfully uploaded multiple files',
          fileNames,
          filePaths,
        }),
      );

      return filePaths;
    } catch (error: any) {
      console.log(error);
      this.loggerService.log(
        JSON.stringify({
          message: 'uploadFiles: Error uploading multiple files',
          fileNames,
          error: error.message,
        }),
      );

      throw new HttpException('Server failed', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }
}
