import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReminderService } from '../services/reminder.service';
import { AuthGuard } from '@/common/guards/auth.guard';
import { SendEmailDto } from '../dto/send-email';

@Controller('reminders')
@UseGuards(AuthGuard)
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Get('/')
  async getAllReminders() {
    return this.reminderService.getAllInternalReminders();
  }

  @Get('email/templates')
  async getEmailTemplates() {
    return this.reminderService.getEmailTemplates();
  }

  @Get('email/external/history')
  async getExternalEmailHistory() {
    return this.reminderService.getExternalCommunicationHistory();
  }

  @Get('/:id')
  async getReminderDocById(@Param('id') id: string) {
    return this.reminderService.getReminderById(id);
  }

  @Post('/send-email-to-client')
  async sendEmailToClient(@Body() body: SendEmailDto) {
    return this.reminderService.sendEmailToClient(body);
  }
}
