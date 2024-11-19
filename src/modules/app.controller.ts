import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuard } from '@/common/guards/auth.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('/url-for-upload')
  @UseGuards(AuthGuard)
  async getUrlForUpload(@Body() body: { filename: string }) {
    return this.appService.getUrlForUpload(body.filename);
  }
}
