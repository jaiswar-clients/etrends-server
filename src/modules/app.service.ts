import { LoggerService } from '@/common/logger/services/logger.service';
import { StorageService } from '@/common/storage/services/storage.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as mongoose from 'mongoose';

@Injectable()
export class AppService {
  constructor(
    private storageService: StorageService,
    private loggerService: LoggerService,
    @InjectConnection() private connection: Connection,
  ) {}

  async uploadFile(file: Express.Multer.File, fileName: string) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'uploadFile: Start uploading file',
          fileName,
        }),
      );

      const filePath = await this.storageService.uploadFile(file, fileName);

      this.loggerService.log(
        JSON.stringify({
          message: 'uploadFile: Successfully uploaded file',
          fileName,
          filePath,
        }),
      );

      return filePath;
    } catch (error: any) {
      console.log(error);
      this.loggerService.log(
        JSON.stringify({
          message: 'uploadFile: Error uploading file',
          fileName,
          error: error.message,
        }),
      );

      throw new HttpException('Server failed', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }

  async uploadFiles(files: Express.Multer.File[], fileNames: string[]) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'uploadFiles: Start uploading multiple files',
          fileNames,
        }),
      );

      const filePaths = await Promise.all(
        files.map((file, index) =>
          this.storageService.uploadFile(file, fileNames[index]),
        ),
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'uploadFiles: Successfully uploaded multiple files',
          fileNames,
          filePaths,
        }),
      );

      return filePaths;
    } catch (error: any) {
      console.log(error);
      this.loggerService.log(
        JSON.stringify({
          message: 'uploadFiles: Error uploading multiple files',
          fileNames,
          error: error.message,
        }),
      );

      throw new HttpException('Server failed', HttpStatus.BAD_GATEWAY, {
        cause: error,
      });
    }
  }

  async cloneDatabase(sourceDbUri: string, targetDbUri: string) {
    let sourceConnection: Connection | null = null;
    let targetConnection: Connection | null = null;
    
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'cloneDatabase: Starting database cloning process',
          sourceDbUri: this.maskConnectionString(sourceDbUri),
          targetDbUri: this.maskConnectionString(targetDbUri),
        }),
      );

      // Create connections to source and target databases
      sourceConnection = await mongoose.createConnection(sourceDbUri).asPromise();
      targetConnection = await mongoose.createConnection(targetDbUri).asPromise();

      this.loggerService.log(
        JSON.stringify({
          message: 'cloneDatabase: Successfully connected to both databases',
        }),
      );

      // Get all collection names from source database
      const collections = await sourceConnection.db.listCollections().toArray();
      const collectionNames = collections.map(col => col.name);

      this.loggerService.log(
        JSON.stringify({
          message: 'cloneDatabase: Found collections in source database',
          collectionNames,
          totalCollections: collectionNames.length,
        }),
      );

      let clonedCollections = 0;
      let totalDocuments = 0;

      // Clone each collection
      for (const collectionName of collectionNames) {
        try {
          this.loggerService.log(
            JSON.stringify({
              message: 'cloneDatabase: Starting to clone collection',
              collectionName,
            }),
          );

          // Get source collection
          const sourceCollection = sourceConnection.db.collection(collectionName);
          
          // Get target collection
          const targetCollection = targetConnection.db.collection(collectionName);

          // Drop target collection if it exists (to ensure clean clone)
          try {
            await targetCollection.drop();
            this.loggerService.log(
              JSON.stringify({
                message: 'cloneDatabase: Dropped existing target collection',
                collectionName,
              }),
            );
          } catch (dropError: any) {
            // Collection might not exist, which is fine
            if (dropError.codeName !== 'NamespaceNotFound') {
              this.loggerService.log(
                JSON.stringify({
                  message: 'cloneDatabase: Warning during collection drop',
                  collectionName,
                  error: dropError.message,
                }),
              );
            }
          }

          // Get all documents from source collection
          const documents = await sourceCollection.find({}).toArray();
          
          if (documents.length > 0) {
            // Insert documents into target collection
            await targetCollection.insertMany(documents);
            totalDocuments += documents.length;
          }

          clonedCollections++;

          this.loggerService.log(
            JSON.stringify({
              message: 'cloneDatabase: Successfully cloned collection',
              collectionName,
              documentCount: documents.length,
            }),
          );

        } catch (collectionError: any) {
          this.loggerService.error(
            JSON.stringify({
              message: 'cloneDatabase: Error cloning collection',
              collectionName,
              error: collectionError.message,
              stack: collectionError.stack,
            }),
          );
          // Continue with other collections
        }
      }

      // Clone indexes for each collection
      await this.cloneIndexes(sourceConnection, targetConnection, collectionNames);

      this.loggerService.log(
        JSON.stringify({
          message: 'cloneDatabase: Database cloning completed successfully',
          totalCollections: collectionNames.length,
          clonedCollections,
          totalDocuments,
        }),
      );

      return {
        success: true,
        totalCollections: collectionNames.length,
        clonedCollections,
        totalDocuments,
      };

    } catch (error: any) {
      console.log(error);
      this.loggerService.error(
        JSON.stringify({
          message: 'cloneDatabase: Fatal error during database cloning',
          error: error.message,
          stack: error.stack,
        }),
      );

      throw new HttpException(
        'Database cloning failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: error }
      );
    } finally {
      // Close connections
      if (sourceConnection) {
        await sourceConnection.close();
        this.loggerService.log(
          JSON.stringify({
            message: 'cloneDatabase: Closed source database connection',
          }),
        );
      }
      if (targetConnection) {
        await targetConnection.close();
        this.loggerService.log(
          JSON.stringify({
            message: 'cloneDatabase: Closed target database connection',
          }),
        );
      }
    }
  }

  private async cloneIndexes(
    sourceConnection: Connection,
    targetConnection: Connection,
    collectionNames: string[]
  ) {
    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'cloneDatabase: Starting index cloning process',
        }),
      );

      let clonedIndexes = 0;

      for (const collectionName of collectionNames) {
        try {
          const sourceCollection = sourceConnection.db.collection(collectionName);
          const targetCollection = targetConnection.db.collection(collectionName);

          // Get indexes from source collection
          const indexes = await sourceCollection.indexes();
          
          // Filter out the default _id index as it's created automatically
          const customIndexes = indexes.filter(index => index.name !== '_id_');

          if (customIndexes.length > 0) {
            for (const index of customIndexes) {
              try {
                // Create index on target collection
                await targetCollection.createIndex(index.key, {
                  name: index.name,
                  unique: index.unique || false,
                  sparse: index.sparse || false,
                  background: true,
                  ...index.options,
                });
                clonedIndexes++;
              } catch (indexError: any) {
                this.loggerService.error(
                  JSON.stringify({
                    message: 'cloneDatabase: Error creating index',
                    collectionName,
                    indexName: index.name,
                    error: indexError.message,
                  }),
                );
              }
            }

            this.loggerService.log(
              JSON.stringify({
                message: 'cloneDatabase: Cloned indexes for collection',
                collectionName,
                indexCount: customIndexes.length,
              }),
            );
          }

        } catch (collectionIndexError: any) {
          this.loggerService.error(
            JSON.stringify({
              message: 'cloneDatabase: Error processing indexes for collection',
              collectionName,
              error: collectionIndexError.message,
            }),
          );
        }
      }

      this.loggerService.log(
        JSON.stringify({
          message: 'cloneDatabase: Index cloning completed',
          totalIndexesCloned: clonedIndexes,
        }),
      );

    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'cloneDatabase: Error during index cloning process',
          error: error.message,
        }),
      );
    }
  }

  private maskConnectionString(connectionString: string): string {
    // Mask password in connection string for logging
    return connectionString.replace(/:([^:@]+)@/, ':****@');
  }
}
