import { ConfigService } from '@/common/config/services/config.service';
import { User } from '@/db/schema/user.schema';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { CreateUserDto } from '../dto/create-user.dto';

import * as bcrypt from 'bcrypt';
import { LoggerService } from '@/common/logger/services/logger.service';
import { responseGenerator } from '@/utils/misc';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: SoftDeleteModel<User>,
    private configService: ConfigService,
    private loggerService: LoggerService,
    private readonly jwtService: JwtService,
  ) {}

  async createUser(body: CreateUserDto) {
    const { email, password } = body;

    this.loggerService.log(
      JSON.stringify({
        message: 'createUser: Initiating user creation process',
        email,
      }),
    );

    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'createUser: Checking if user already exists',
          email,
        }),
      );

      const isUserAlreadyExist = await this.userModel.findOne({ email });
      if (isUserAlreadyExist) {
        this.loggerService.warn(
          JSON.stringify({
            message: 'createUser: User already exists with this email',
            email,
          }),
        );
        throw new HttpException(
          'User already exists with this email',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'createUser: Hashing user password',
          email,
        }),
      );

      const hashedPassword = await bcrypt.hash(password, 10);

      this.loggerService.log(
        JSON.stringify({
          message: 'createUser: Creating new user in the database',
          email,
        }),
      );

      const user = new this.userModel({
        ...body,
        password: hashedPassword,
      });

      const savedUser = await user.save();

      this.loggerService.log(
        JSON.stringify({
          message: 'createUser: User successfully created',
          userId: savedUser._id,
          email,
        }),
      );

      return savedUser;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'createUser: Failed to create user',
          error: error.message,
          stack: error.stack,
        }),
      );
      throw new HttpException('Server failed', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }

  async loginHandler(email: string, password: string) {
    this.loggerService.log('Attempting login for user: ' + email); // Log the login attempt

    try {
      // 1. Check if user exists
      const user = await this.userModel.findOne({ email });
      if (!user) {
        this.loggerService.warn('User not found: ' + email); // Log a warning if user doesn't exist
        throw new HttpException(
          'Invalid credentials: User not found',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // 2. Validate password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        this.loggerService.warn('Invalid password for user: ' + email); // Log a warning for invalid password
        throw new HttpException(
          'Invalid credentials: Incorrect password',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const payload = { email: user.email, sub: user._id }; // Customize the payload as needed
      const token = await this.jwtService.signAsync(payload);

      // 3. Successful login
      this.loggerService.log('User logged in successfully: ' + email); // Log successful login

      return responseGenerator('Login Successful', {
        ...user.toObject(),
        token,
      });
    } catch (error: any) {
      this.loggerService.error('Login failed for user: ' + email, error.stack); // Log the error stack
      throw new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
