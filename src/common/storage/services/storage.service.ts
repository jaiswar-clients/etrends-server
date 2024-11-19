import { ConfigService } from '@/common/config/services/config.service';
import { LoggerService } from '@/common/logger/services/logger.service';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { Injectable } from '@nestjs/common';
import { S3 } from 'aws-sdk';

@Injectable()
export class StorageService {
  private readonly s3: S3;

  constructor(
    private configService: ConfigService,
    private loggerService: LoggerService,
  ) {
    this.s3 = new S3();
  }

  get(filename: string) {
    if (!filename) return;

    const fileUrl = `${this.configService.get('AWS_CLOUDFRONT_DISTRIBUTION')}/${filename}`;

    const preSignedUrl = getSignedUrl({
      url: fileUrl,
      dateLessThan: new Date(Date.now() + 1000 * 60 * 60 * 24).toString(),
      keyPairId: this.configService.get('AWS_CLOUDFRONT_KEY_PAIR'),
      privateKey: this.configService.get('AWS_CLOUDFRONT_PRIVATE_KEY'),
    });
    this.loggerService.log(
      `Retrieved file URL: ${preSignedUrl}`,
      'StorageService',
    );
    return preSignedUrl;
  }

  //   Create Upload function
  async generateUploadUrl(fileName: string) {
    const params = {
      Bucket: this.configService.get('AWS_BUCKET_NAME'),
      Key: fileName,
      Expires: 3600,
    };

    const uploadUrl = await this.s3.getSignedUrlPromise('putObject', params);
    return uploadUrl;
  }
}
