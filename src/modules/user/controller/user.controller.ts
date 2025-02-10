import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserService } from '../services/user.service';
import { LoginUserDto } from '../dto/login-user.dto';
import { Serialize } from '@/interceptors/serialize.interceptor';

import { UserResponseDto } from '../dto/user-response.dto';
import { AuthGuard } from '@/common/guards/auth.guard';

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

  @Get('/internal-team-emails')
  @UseGuards(AuthGuard)
  async getInternalTeamEmails() {
    return this.userService.getInternalTeamEmails();
  }
}
