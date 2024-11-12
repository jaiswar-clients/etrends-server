import { Module } from '@nestjs/common';
import { UserController } from './controller/user.controller';
import { UserService } from './services/user.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '@/db/schema/user.schema';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@/common/config/services/config.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
