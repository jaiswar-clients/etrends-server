import {
  Body,
  Controller,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuard } from '@/common/guards/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString, IsNotEmpty, IsArray } from 'class-validator';

class UploadFileDto {
  @IsString()
  @IsNotEmpty()
  filename: string;
}

class UploadMultipleFilesDto {
  @IsArray()
  @IsNotEmpty()
  filenames: string[];
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('/upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.appService.uploadFile(file, body.filename);
  }

  @Post('/upload-multiple')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('files'))
  async uploadMultipleFiles(
    @UploadedFile() files: Express.Multer.File[],
    @Body() body: UploadMultipleFilesDto,
  ) {
    return this.appService.uploadFiles(files, body.filenames);
  }
}
