"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const config_service_1 = require("../../../common/config/services/config.service");
const user_schema_1 = require("../../../db/schema/user.schema");
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const bcrypt = require("bcrypt");
const logger_service_1 = require("../../../common/logger/services/logger.service");
const misc_1 = require("../../../utils/misc");
const jwt_1 = require("@nestjs/jwt");
let UserService = class UserService {
    constructor(userModel, configService, loggerService, jwtService) {
        this.userModel = userModel;
        this.configService = configService;
        this.loggerService = loggerService;
        this.jwtService = jwtService;
    }
    async createUser(body) {
        const { email, password } = body;
        this.loggerService.log(JSON.stringify({
            message: 'createUser: Initiating user creation process',
            email,
        }));
        try {
            this.loggerService.log(JSON.stringify({
                message: 'createUser: Checking if user already exists',
                email,
            }));
            const isUserAlreadyExist = await this.userModel.findOne({ email });
            if (isUserAlreadyExist) {
                this.loggerService.warn(JSON.stringify({
                    message: 'createUser: User already exists with this email',
                    email,
                }));
                throw new common_1.HttpException('User already exists with this email', common_1.HttpStatus.BAD_REQUEST);
            }
            this.loggerService.log(JSON.stringify({
                message: 'createUser: Hashing user password',
                email,
            }));
            const hashedPassword = await bcrypt.hash(password, 10);
            this.loggerService.log(JSON.stringify({
                message: 'createUser: Creating new user in the database',
                email,
            }));
            const user = new this.userModel({
                ...body,
                password: hashedPassword,
            });
            const savedUser = await user.save();
            this.loggerService.log(JSON.stringify({
                message: 'createUser: User successfully created',
                userId: savedUser._id,
                email,
            }));
            return (0, misc_1.responseGenerator)('User created successfully', savedUser);
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'createUser: Failed to create user',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException('Server failed', common_1.HttpStatus.BAD_GATEWAY, {
                cause: error,
            });
        }
    }
    async loginHandler(email, password) {
        this.loggerService.log('Attempting login for user: ' + email);
        try {
            const user = await this.userModel.findOne({ email });
            if (!user) {
                this.loggerService.warn('User not found: ' + email);
                throw new common_1.HttpException('Invalid credentials: User not found', common_1.HttpStatus.UNAUTHORIZED);
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                this.loggerService.warn('Invalid password for user: ' + email);
                throw new common_1.HttpException('Invalid credentials: Incorrect password', common_1.HttpStatus.UNAUTHORIZED);
            }
            const payload = { email: user.email, sub: user._id };
            const token = await this.jwtService.signAsync(payload);
            this.loggerService.log('User logged in successfully: ' + email);
            return (0, misc_1.responseGenerator)('Login Successful', {
                ...user.toObject(),
                token,
            });
        }
        catch (error) {
            this.loggerService.error('Login failed for user: ' + email, error.stack);
            throw new common_1.HttpException('Server error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getInternalTeamEmails() {
        try {
            this.loggerService.log(JSON.stringify({
                message: 'getInternalTeamEmails: Fetching all users',
            }));
            const users = await this.userModel.find();
            this.loggerService.log(JSON.stringify({
                message: 'getInternalTeamEmails: Successfully fetched users',
                data: { count: users.length },
            }));
            const emails = users.map((user) => ({
                name: user.name,
                email: user.email,
            }));
            this.loggerService.log(JSON.stringify({
                message: 'getInternalTeamEmails: Extracted emails from users',
                data: { emailCount: emails.length },
            }));
            return (0, misc_1.responseGenerator)('Internal team emails fetched successfully', emails);
        }
        catch (error) {
            this.loggerService.error(JSON.stringify({
                message: 'getInternalTeamEmails: Error fetching internal team emails',
                error: error.message,
                stack: error.stack,
            }));
            throw new common_1.HttpException('Server error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [Object, config_service_1.ConfigService,
        logger_service_1.LoggerService,
        jwt_1.JwtService])
], UserService);
//# sourceMappingURL=user.service.js.map