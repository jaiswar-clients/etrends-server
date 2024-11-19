import { LoggerService } from '@/common/logger/services/logger.service';
import { StorageService } from '@/common/storage/services/storage.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(
    private storageService: StorageService,
    private loggerService: LoggerService,
  ) {}

  async getUrlForUpload(fileName: string) {
    try {
      // Log the start of the URL generation process
      this.loggerService.log(
        JSON.stringify({
          message: 'getUrlForUpload: Start generating upload URL',
          fileName,
        }),
      );

      // Generate the presigned upload URL
      const url = await this.storageService.generateUploadUrl(fileName);

      // Log the successful generation of the URL
      this.loggerService.log(
        JSON.stringify({
          message: 'getUrlForUpload: Successfully generated upload URL',
          fileName,
          url,
        }),
      );

      return url;
    } catch (error: any) {
      // Log the error that occurred during URL generation
      this.loggerService.log(
        JSON.stringify({
          message: 'getUrlForUpload: Error generating upload URL',
          fileName,
          error: error.message,
        }),
      );

      // Throw an HTTP exception with additional details
      throw new HttpException('Server failed', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }
}
