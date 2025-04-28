import { LoggerService } from '@/common/logger/services/logger.service';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';

@Injectable()
export class BackupService {
  private readonly rootBackupDir: string;

  constructor(
    @InjectConnection() private connection: Connection,
    private loggerService: LoggerService,
  ) {
    // Initialize backup directory at project root
    this.rootBackupDir = path.join(process.cwd(), 'backup');
    this.ensureBackupDirExists();
  }

  private ensureBackupDirExists(): void {
    if (!fs.existsSync(this.rootBackupDir)) {
      fs.mkdirSync(this.rootBackupDir, { recursive: true });
      this.loggerService.log(JSON.stringify({ message: 'Created backup directory', path: this.rootBackupDir }));
    }
  }

  private formatDate(date: Date): string {
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    
    const suffix = this.getDaySuffix(day);
    return `${day}${suffix}_${month}_${year}`;
  }

  private getDaySuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  async createBackup(): Promise<string> {
    const date = new Date();
    const dateString = this.formatDate(date);
    const backupDir = path.join(this.rootBackupDir, dateString);
    let collectionsDumped = 0;

    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'createBackup: Starting database backup using Mongoose',
          backupDirectory: backupDir,
        }),
      );

      // Create today's backup directory if it doesn't exist
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Get all collection names
      const modelNames = Object.keys(this.connection.models);

      this.loggerService.log(JSON.stringify({ message: 'Found models', count: modelNames.length, models: modelNames }));

      for (const modelName of modelNames) {
        const model = this.connection.model(modelName);
        const collectionName = model.collection.collectionName;
        const filePath = path.join(backupDir, `${collectionName}.json`);

        this.loggerService.log(
            JSON.stringify({
                message: 'Backing up collection',
                collectionName,
            }),
        );

        try {
            // Fetch all documents, sort by _id for consistency
            const documents = await model.find().sort({ _id: 1 }).lean().exec();
            
            // Write documents to JSON file
            fs.writeFileSync(filePath, JSON.stringify(documents, null, 2)); // Pretty print JSON
            collectionsDumped++;

             this.loggerService.log(
                JSON.stringify({
                    message: 'Successfully backed up collection',
                    collectionName,
                    documentCount: documents.length,
                    filePath,
                }),
            );
        } catch (collectionError: any) {
             this.loggerService.error(
                JSON.stringify({
                    message: 'Error backing up collection',
                    collectionName,
                    error: collectionError.message,
                    stack: collectionError.stack,
                }),
            );
            // Decide if we should continue with other collections or re-throw
            // For now, we log the error and continue
        }
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'createBackup: Mongoose backup completed successfully',
          backupDirectory: backupDir,
          collectionsDumped,
        }),
      );

      return backupDir;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'createBackup: Error creating database backup using Mongoose',
          error: error.message,
          stack: error.stack,
          backupDirectory: backupDir, // Include directory in error context
        }),
      );
      
      // We might still want to throw an error if the overall process fails significantly
      throw new HttpException('Backup failed', HttpStatus.INTERNAL_SERVER_ERROR, {
        cause: error,
      });
    }
  }

  async cleanupOldBackups(daysToKeep: number = 90): Promise<void> {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'cleanupOldBackups: Starting cleanup of old backups',
          daysToKeep,
          rootBackupDir: this.rootBackupDir,
        }),
      );

      // Ensure the root backup directory exists before trying to read it
      if (!fs.existsSync(this.rootBackupDir)) {
        this.loggerService.log(
            JSON.stringify({
                message: 'cleanupOldBackups: Root backup directory does not exist, nothing to clean.',
                rootBackupDir: this.rootBackupDir,
            }),
        );
        return;
      }

      const now = new Date().getTime();
      const millisToKeep = daysToKeep * 24 * 60 * 60 * 1000;
      const entries = fs.readdirSync(this.rootBackupDir, { withFileTypes: true });
      let deletedCount = 0;

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(this.rootBackupDir, entry.name);
          try {
            const stats = fs.statSync(dirPath);
            if (now - stats.mtime.getTime() > millisToKeep) {
              fs.rmSync(dirPath, { recursive: true, force: true });
              deletedCount++;
              this.loggerService.log(
                JSON.stringify({
                  message: 'cleanupOldBackups: Deleted old backup directory',
                  directory: entry.name,
                  path: dirPath,
                  createdAt: stats.mtime,
                }),
              );
            }
          } catch (statError: any) {
            // Log error if we can't get stats or delete, but continue cleanup
            this.loggerService.error(
              JSON.stringify({
                message: 'cleanupOldBackups: Error processing directory for cleanup',
                directory: entry.name,
                path: dirPath,
                error: statError.message,
              }),
            );
          }
        }
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'cleanupOldBackups: Cleanup completed',
          deletedCount,
        }),
      );
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'cleanupOldBackups: Error cleaning up old backups',
          error: error.message,
          stack: error.stack,
        }),
      );
      
      // Do not throw HttpException here, as cleanup failure shouldn't crash the app
      // Log the error sufficiently.
    }
  }
} 