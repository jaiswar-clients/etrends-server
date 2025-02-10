import { ConfigService } from '@/common/config/services/config.service';
import { User } from '@/db/schema/user.schema';
import { SoftDeleteModel } from 'mongoose-delete';
import { CreateUserDto } from '../dto/create-user.dto';
import { LoggerService } from '@/common/logger/services/logger.service';
import { JwtService } from '@nestjs/jwt';
export declare class UserService {
    private userModel;
    private configService;
    private loggerService;
    private readonly jwtService;
    constructor(userModel: SoftDeleteModel<User>, configService: ConfigService, loggerService: LoggerService, jwtService: JwtService);
    createUser(body: CreateUserDto): Promise<{
        message: string;
        data: any;
        success: boolean;
    }>;
    loginHandler(email: string, password: string): Promise<{
        message: string;
        data: any;
        success: boolean;
    }>;
    getInternalTeamEmails(): Promise<{
        message: string;
        data: any;
        success: boolean;
    }>;
}
