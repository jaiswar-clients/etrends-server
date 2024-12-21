import { ReminderService } from '../services/reminder.service';
import { SendEmailDto } from '../dto/send-email';
export declare class ReminderController {
    private readonly reminderService;
    constructor(reminderService: ReminderService);
    getAllReminders(): Promise<any[]>;
    getReminderDocById(id: string): Promise<import("mongoose").Document<unknown, {}, import("../../../db/schema/reminder.schema").Reminder> & import("../../../db/schema/reminder.schema").Reminder & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    sendEmailToClient(body: SendEmailDto): Promise<string>;
}
