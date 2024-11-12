import { Body, Controller, Post } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserService } from '../services/user.service';
import { LoginUserDto } from '../dto/login-user.dto';
import { Serialize } from '@/interceptors/serialize.interceptor';

import { UserResponseDto } from '../dto/user-response.dto';

@Controller('users')
@Serialize(UserResponseDto)
export class UserController {
  constructor(private userService: UserService) {}

  @Post()
  async createUser(@Body() body: CreateUserDto) {
    return this.userService.createUser(body);
  }

  @Post('/login')
  async loginUser(@Body() body: LoginUserDto) {
    return this.userService.loginHandler(body.email, body.password);
  }
}
