import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { Module } from '@nestjs/common';
import { MailService } from './service/mail.service';
import { join } from 'path';
import { ConfigService } from '../config/services/config.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get('EMAIL_DOMAIN'),
          port: configService.get('EMAIL_PORT'),
          secureConnection: false,
          auth: {
            user: configService.get('EMAIL_ID'),
            pass: configService.get('EMAIL_PASSWORD'),
          },
          tls:{
            ciphers:'SSLv3'
          }
        },
        defaults: {
          from: `"No Reply" <${configService.get('EMAIL_ID')}>`,
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new PugAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
