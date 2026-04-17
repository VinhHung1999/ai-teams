import path from 'path';
import { IStorage } from './IStorage';
import { MarkdownStorage } from './MarkdownStorage';

let _storage: IStorage | null = null;

export async function getStorage(): Promise<IStorage> {
  if (_storage) return _storage;

  const dataDir = path.join(__dirname, '../../data');
  const md = new MarkdownStorage(dataDir);
  await md.init();
  _storage = md;
  console.log('[storage] Using MarkdownStorage');

  return _storage;
}

/** Reset singleton (for testing). */
export function resetStorage(): void {
  _storage = null;
}
