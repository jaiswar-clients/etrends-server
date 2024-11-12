import { Module } from '@nestjs/common';
import { ClientController } from './controller/client.controller';
import { ClientService } from './services/client.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Client, ClientSchema } from '@/db/schema/client.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Client.name, schema: ClientSchema }]),
  ],
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}
