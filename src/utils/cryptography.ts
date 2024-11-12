import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''; // 32 characters
const IV = process.env.IV || ''; // 16 characters

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error('Invalid ENCRYPTION_KEY. It must be 32 characters long.');
}

if (!IV || IV.length !== 16) {
  throw new Error('Invalid IV. It must be 16 characters long.');
}

/**
 * Encrypts plain text into an encrypted format.
 * @param text - The text to be encrypted.
 * @returns The encrypted data as a base64-encoded string.
 */
export function encrypt(text: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), IV);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

/**
 * Decrypts encrypted text back to plain text.
 * @param encryptedText - The encrypted text to be decrypted.
 * @returns The decrypted plain text.
 */
export function decrypt(encryptedText: string): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), IV);
  let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
