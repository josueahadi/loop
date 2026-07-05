import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as admin from 'firebase-admin';

// Loads the Firebase service-account credentials from inline JSON
// (FIREBASE_SERVICE_ACCOUNT_JSON — preferred on Railway, no file to mount) or a
// JSON file path (FIREBASE_SERVICE_ACCOUNT_PATH). Inline wins. Shared by Storage
// and Push so the two can't drift on how they read credentials.
export function loadFirebaseServiceAccount(
  config: ConfigService,
): admin.ServiceAccount {
  const inline = config.get<string>('storage.serviceAccountJson') ?? '';
  if (inline.trim()) {
    return JSON.parse(inline) as admin.ServiceAccount;
  }
  const path = config.get<string>('storage.serviceAccountPath') ?? '';
  return JSON.parse(fs.readFileSync(path, 'utf8')) as admin.ServiceAccount;
}
