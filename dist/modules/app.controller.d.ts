import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getUrlForUpload(body: {
        filename: string;
    }): Promise<string>;
}
