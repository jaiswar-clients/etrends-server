import { CreateUserDto } from '../dto/create-user.dto';
import { UserService } from '../services/user.service';
import { LoginUserDto } from '../dto/login-user.dto';
export declare class UserController {
    private userService;
    constructor(userService: UserService);
    createUser(body: CreateUserDto): Promise<{
        message: string;
        data: any;
        success: boolean;
    }>;
    loginUser(body: LoginUserDto): Promise<{
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
