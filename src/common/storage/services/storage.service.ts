import { ConfigService } from '@/common/config/services/config.service';
import { LoggerService } from '@/common/logger/services/logger.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly filesPath: string;

  constructor(
    private configService: ConfigService,
    private loggerService: LoggerService,
  ) {
    this.filesPath = this.configService.get('FILES_PATH');
    // Ensure the upload directory exists
    if (!fs.existsSync(this.filesPath)) {
      fs.mkdirSync(this.filesPath, { recursive: true });
    }
  }

  get(filename: string) {
    if (!filename) {
      return null;
    }
    const filePath = path.join(this.filesPath, filename);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return `${this.configService.get('APP_URL')}/v1/files/${filename}`;
  }

  async uploadFile(file: Express.Multer.File, fileName: string): Promise<string> {
    if (!fileName) {
      throw new BadRequestException('Filename is required');
    }

    if (!file) {
      throw new BadRequestException('File is required');
    }

    try {
      const filePath = path.join(this.filesPath, fileName);
      
      // Create write stream and pipe the file buffer to it
      await fs.promises.writeFile(filePath, file.buffer);
      
      this.loggerService.log(
        `File uploaded successfully: ${filePath}`,
        'StorageService',
      );
      
      return fileName;
    } catch (error: any) {
      this.loggerService.error(
        `Error uploading file: ${error.message}`,
        error.stack,
        'StorageService',
      );
      throw error;
    }
  }
}
