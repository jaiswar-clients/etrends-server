import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { LoggerModule } from '@/common/logger/logger.module';
import { ConfigModule } from '@/common/config/config.module';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([]), // Import MongooseModule, models can be added if needed directly here later
    LoggerModule, 
    ConfigModule
  ],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {} 