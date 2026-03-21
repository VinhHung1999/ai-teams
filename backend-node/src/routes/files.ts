import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

const EXCLUDED = new Set([
  'node_modules', '.git', '__pycache__', '.next', 'dist', '.venv', '.DS_Store',
]);

const EXT_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'scss',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.sql': 'sql',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c', '.h': 'c',
  '.cpp': 'cpp', '.hpp': 'cpp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.toml': 'toml',
  '.xml': 'xml',
  '.svg': 'svg',
  '.env': 'dotenv',
  '.txt': 'text',
  '.csv': 'csv',
  '.prisma': 'prisma',
  '.graphql': 'graphql', '.gql': 'graphql',
  '.dockerfile': 'dockerfile',
  '.lock': 'text',
};

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
  '.mp3', '.mp4', '.wav', '.avi', '.mov',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.eot',
  '.pyc', '.pyo', '.class',
]);

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;

  // Check first 8KB for null bytes
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return true;
    }
  } catch {
    // If we can't read, assume not binary
  }
  return false;
}

function detectLanguage(filePath: string): string {
  const basename = path.basename(filePath).toLowerCase();
  if (basename === 'dockerfile') return 'dockerfile';
  if (basename === 'makefile') return 'makefile';
  if (basename === '.gitignore' || basename === '.dockerignore') return 'text';

  const ext = path.extname(filePath).toLowerCase();
  return EXT_LANGUAGE[ext] || 'text';
}

// GET /api/files/tree?path=...&show_hidden=true
router.get('/api/files/tree', (req: Request, res: Response) => {
  const dirPath = req.query.path as string;
  const showHidden = req.query.show_hidden === 'true';

  if (!dirPath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Not a directory' });
    }
  } catch {
    return res.status(400).json({ error: 'Directory not found or not accessible' });
  }

  try {
    const rawEntries = fs.readdirSync(dirPath, { withFileTypes: true });

    const entries: { name: string; type: 'dir' | 'file'; path: string; size?: number }[] = [];

    for (const entry of rawEntries) {
      if (EXCLUDED.has(entry.name)) continue;
      if (!showHidden && entry.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        entries.push({ name: entry.name, type: 'dir', path: fullPath });
      } else if (entry.isFile()) {
        try {
          const s = fs.statSync(fullPath);
          entries.push({ name: entry.name, type: 'file', path: fullPath, size: s.size });
        } catch {
          entries.push({ name: entry.name, type: 'file', path: fullPath });
        }
      }
    }

    // Sort: dirs first, then files, alphabetical within each group
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return res.json({ path: dirPath, entries });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list directory' });
  }
});

// GET /api/files/read?path=...
router.get('/api/files/read', (req: Request, res: Response) => {
  const filePath = req.query.path as string;

  if (!filePath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  try {
    const stat = fs.statSync(filePath);

    if (!stat.isFile()) {
      return res.status(400).json({ error: 'Not a file' });
    }

    if (stat.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Maximum is 1MB.` });
    }

    if (isBinaryFile(filePath)) {
      return res.status(400).json({ error: 'Binary file cannot be displayed' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const language = detectLanguage(filePath);

    return res.json({
      path: filePath,
      content,
      language,
      size: stat.size,
    });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    return res.status(500).json({ error: err.message || 'Failed to read file' });
  }
});

export default router;
