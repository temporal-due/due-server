import { BadRequestException } from '@nestjs/common';

export function encodeCursor(id: number): string {
  return Buffer.from(String(id)).toString('base64url');
}

export function decodeCursor(cursor: string): number {
  const id = parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10);
  if (isNaN(id) || id <= 0) {
    throw new BadRequestException('Invalid cursor');
  }
  return id;
}
