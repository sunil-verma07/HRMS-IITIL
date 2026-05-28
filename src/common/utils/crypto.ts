import { createHash, randomBytes } from 'crypto';

export function createOpaqueToken(byteLength = 48): string {
  return randomBytes(byteLength).toString('hex');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
