import {
  ConfigService as NestConfigService,
  ConfigModule as NestJsConfigModule,
} from '@nestjs/config';
import { Global, Module } from '@nestjs/common';
import { app } from './variables';
import { validationSchema } from './config.validation';
import { ConfigService } from './services/config.service';

@Global()
@Module({
  imports: [
    NestJsConfigModule.forRoot({
      load: [app],
      cache: true,
      expandVariables: true,
      isGlobal: true,
      validationSchema: validationSchema,
    }),
  ],
  controllers: [],
  providers: [ConfigService, NestConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
