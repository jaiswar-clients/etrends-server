import { DynamicModule, ForwardReference, Module, Type } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from '@/common/logger/logger.module';
import { HttpModule } from '@/common/http/http.module';
import { ConfigModule } from '@/common/config/config.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@/common/config/services/config.service';
import { UserModule } from './user/user.module';
import { ClientModule } from './client/client.module';
import { OrderModule } from './order/order.module';
import { JwtModule } from '@nestjs/jwt';
import { StorageModule } from '@/common/storage/storage.module';
import { ProductModule } from './product/product.module';

type NestModuleImport =
  | Type<any>
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference<any>;

const appModules: NestModuleImport[] = [LoggerModule, HttpModule, ConfigModule];

@Module({
  imports: [
    ...appModules,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('DATABASE_URL'),
      }),
    }),
    JwtModule.registerAsync({
      global:true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        global: true,
        secret: configService.get('JWT_SECRET'),
      }),
    }),
    UserModule,
    ClientModule,
    OrderModule,
    StorageModule,
    ProductModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
