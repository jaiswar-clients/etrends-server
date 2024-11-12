import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@/common/config/services/config.service';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { ResponseInterceptor } from '@/interceptors/response.interceptor';
import { HttpExceptionInterceptor as HttpExceptionFilter } from '@/common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    cors: true,
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get('PORT');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const reflector = new Reflector();

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.useBodyParser('text');
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      forbidUnknownValues: true,
    }),
  );

  await app.listen(port);
}

// AppClusterService.clusterize(bootstrap); // uncomment this to enable clustering
bootstrap();
