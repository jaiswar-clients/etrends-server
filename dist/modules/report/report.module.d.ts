import { OnModuleInit } from '@nestjs/common';
import { ReportService } from './services/report.service';
export declare class ReportModule implements OnModuleInit {
    private readonly reportService;
    constructor(reportService: ReportService);
    onModuleInit(): Promise<void>;
}
