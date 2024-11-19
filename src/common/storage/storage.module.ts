import { Module } from '@nestjs/common';
import { StorageService } from './services/storage.service';

@Module({
  imports: [],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
