import { Expose } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
} from 'class-validator';

export class UserResponseDto {
  @IsString()
  @IsNotEmpty()
  @Expose()
  _id: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  token: string;

  @IsEmail()
  @IsNotEmpty()
  @Expose()
  email: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  @Expose()
  designation: string; 
}
