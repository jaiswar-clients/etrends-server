import { OnModuleInit } from '@nestjs/common';
import { ReminderService } from './services/reminder.service';
export declare class ReminderModule implements OnModuleInit {
    private reminderService;
    constructor(reminderService: ReminderService);
    onModuleInit(): Promise<void>;
}
