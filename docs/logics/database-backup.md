# Database Backup System

## Overview

The database backup system automatically creates daily backups of the MongoDB database and manages the retention policy by removing backup files older than 90 days. This system uses Mongoose to directly interact with the database, avoiding external tool dependencies like `mongodump`.

## Features

1. **Daily Automated Backups**
   - Creates a database backup every day at 1:00 AM using Mongoose.
   - Organizes backups in date-formatted folders (e.g., `20th_Feb_2024`).
   - Fetches all documents from each registered Mongoose model.
   - Sorts documents by `_id` to ensure consistent export order.
   - Saves each collection's data as a separate JSON file (e.g., `users.json`).

2. **Backup Cleanup**
   - Automatically removes backup folders older than 90 days.
   - Runs daily at 3:00 AM to ensure efficient disk space usage.
   - Logs all deletion operations for auditing purposes.

## Implementation Details

### Backup Service (`BackupService`)

The service utilizes the injected Mongoose `Connection` to access database models.

- **`createBackup()`**: Creates a new database backup.
  - Gets a list of all registered Mongoose model names from the connection.
  - Creates a date-formatted directory (e.g., `backup/20th_Feb_2024`).
  - Iterates through each model:
    - Fetches all documents using `model.find().sort({ _id: 1 }).lean().exec()`.
    - Writes the array of documents to a JSON file named `[collectionName].json` within the backup directory.
  - Logs the process, including counts and file paths.
  - Handles errors during the backup of individual collections gracefully, logging the error and continuing with other collections where possible.

- **`cleanupOldBackups(daysToKeep = 90)`**: Deletes old backup directories.
  - Scans directories within the root `backup` folder.
  - Calculates directory age based on modification time.
  - Removes directories older than the specified retention period (default: 90 days).
  - Logs details of each deleted backup.

### Cron Tasks (`TasksService`)

Two scheduled tasks handle backup operations:

1. **`createDatabaseBackup`**: Runs daily at 1:00 AM.
   - Calls `backupService.createBackup()`.
   - Logs the start and completion of the backup process.
   - Handles errors and logs them in JSON format.

2. **`cleanupOldBackups`**: Runs daily at 3:00 AM.
   - Calls `backupService.cleanupOldBackups()`.
   - Logs the cleanup process and any errors that occur.

## Backup Directory Structure

```
/backup/
  ├── 20th_Feb_2024/
  │   ├── users.json         # Contains array of user documents
  │   ├── products.json      # Contains array of product documents
  │   └── ... (one JSON file per collection)
  ├── 21st_Feb_2024/
  │   └── ...
  └── ...
```

## Prerequisites

- The application must have read access to the MongoDB database via Mongoose.
- The system user running the application must have write permissions to the `backup` directory in the project root.

## Error Handling

- Errors during the backup of a specific collection are logged, but the process attempts to continue with other collections.
- Overall backup failure or cleanup failure logs detailed errors in JSON format.
- Cleanup errors are logged but do not throw exceptions that would halt the application.

## Log Format

Operations are logged in JSON format:

```json
// Example: Collection backup success
{
  "message": "Successfully backed up collection",
  "collectionName": "users",
  "documentCount": 150,
  "filePath": "/app/backup/20th_Feb_2024/users.json"
}

// Example: Cleanup completion
{
  "message": "cleanupOldBackups: Cleanup completed",
  "deletedCount": 3
}
```

## Configuration

- The backup system uses the Mongoose connection established by the application.
- The backup directory (`backup`) is automatically created in the project's root folder if it doesn't exist.

## Security Considerations

- Backup files contain application data and should be protected accordingly (e.g., file system permissions).
- Consider encrypting backups if storing them in less secure locations.
- The process relies on the application's existing database connection security. 