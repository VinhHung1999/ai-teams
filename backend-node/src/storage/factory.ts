import path from 'path';
import { PrismaClient } from '@prisma/client';
import { IStorage } from './IStorage';
import { PostgresStorage } from './PostgresStorage';
import { MarkdownStorage } from './MarkdownStorage';

let _storage: IStorage | null = null;

export async function getStorage(): Promise<IStorage> {
  if (_storage) return _storage;

  const mode = (process.env.STORAGE ?? 'postgres').toLowerCase();

  if (mode === 'markdown') {
    const dataDir = path.join(__dirname, '../../data');
    const md = new MarkdownStorage(dataDir);
    await md.init();
    _storage = md;
    console.log('[storage] Using MarkdownStorage');
  } else {
    const prisma = new PrismaClient();
    _storage = new PostgresStorage(prisma);
    console.log('[storage] Using PostgresStorage');
  }

  return _storage;
}

/** Reset singleton (for testing). */
export function resetStorage(): void {
  _storage = null;
}
