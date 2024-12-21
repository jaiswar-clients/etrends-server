import { CreateUserDto } from '../dto/create-user.dto';
import { UserService } from '../services/user.service';
import { LoginUserDto } from '../dto/login-user.dto';
export declare class UserController {
    private userService;
    constructor(userService: UserService);
    createUser(body: CreateUserDto): Promise<import("mongoose").Document<unknown, {}, import("../../../db/schema/user.schema").User> & import("../../../db/schema/user.schema").User & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    loginUser(body: LoginUserDto): Promise<{
        message: string;
        data: any;
        success: boolean;
    }>;
}
