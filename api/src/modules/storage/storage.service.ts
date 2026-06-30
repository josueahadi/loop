import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as admin from 'firebase-admin';

export interface UploadResult {
  // Object PATH inside the private bucket — never a public URL.
  storageReference: string;
}

// Uploads verification documents to a PRIVATE Firebase Storage bucket.
// API-mediated only: clients never touch Storage directly. A 'stub' driver lets
// auth/verification flows run in dev without Firebase credentials.
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger('Storage');
  private bucket: ReturnType<admin.storage.Storage['bucket']> | null = null;
  private readonly driver: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('storage.driver') ?? 'stub';
  }

  onModuleInit() {
    if (this.driver !== 'firebase') {
      this.logger.warn('STORAGE_DRIVER=stub — documents are not uploaded to Firebase');
      return;
    }
    const path = this.config.get<string>('storage.serviceAccountPath') ?? '';
    const bucketName = this.config.get<string>('storage.bucket') ?? '';
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(fs.readFileSync(path, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: bucketName,
      });
    }
    this.bucket = admin.storage().bucket();
  }

  async upload(
    objectPath: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    if (this.driver !== 'firebase' || !this.bucket) {
      // Dev stub: pretend the upload happened, return a deterministic reference.
      this.logger.log(`[stub upload] ${objectPath} (${buffer.length} bytes)`);
      return { storageReference: objectPath };
    }
    const file = this.bucket.file(objectPath);
    await file.save(buffer, {
      contentType,
      resumable: false,
      // No public access — bucket/object stays private. Access via signed URLs later.
      private: true,
    });
    return { storageReference: objectPath };
  }
}
