import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  // If stored in salt:hash format
  if (stored.includes(':')) {
    const [salt, key] = stored.split(':');
    const hash = scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    if (hash.length !== keyBuffer.length) return false;
    return timingSafeEqual(hash, keyBuffer);
  }
  // Fallback for plain text if any
  return password === stored;
}
