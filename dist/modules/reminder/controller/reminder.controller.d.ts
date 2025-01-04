import { ReminderService } from '../services/reminder.service';
import { SendEmailDto } from '../dto/send-email';
export declare class ReminderController {
    private readonly reminderService;
    constructor(reminderService: ReminderService);
    getAllReminders(): Promise<any[]>;
    getEmailTemplates(): Promise<(import("mongoose").Document<unknown, {}, import("mongoose").Document<unknown, {}, import("../../../db/schema/reminders/email.template.schema").EmailTemplate> & import("../../../db/schema/reminders/email.template.schema").EmailTemplate & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }> & import("mongoose").Document<unknown, {}, import("../../../db/schema/reminders/email.template.schema").EmailTemplate> & import("../../../db/schema/reminders/email.template.schema").EmailTemplate & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    getExternalEmailHistory(): Promise<(import("mongoose").Document<unknown, {}, import("../../../db/schema/reminders/reminder.schema").Reminder> & import("../../../db/schema/reminders/reminder.schema").Reminder & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    getReminderDocById(id: string): Promise<import("mongoose").Document<unknown, {}, import("../../../db/schema/reminders/reminder.schema").Reminder> & import("../../../db/schema/reminders/reminder.schema").Reminder & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    sendEmailToClient(body: SendEmailDto): Promise<string>;
}
