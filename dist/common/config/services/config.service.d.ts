import { ConfigService as NestJsConfigService } from '@nestjs/config';
import ConfigDTO from '../dto';
export declare class ConfigService extends NestJsConfigService<ConfigDTO> {
    constructor();
    get IS_PRODUCTION(): boolean;
}
