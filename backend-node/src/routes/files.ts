import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const router = Router();

// ─── Security: path validation ───────────────────────────────────────────────

/**
 * Resolves and validates a user-supplied path.
 * - Always normalises via path.resolve() (strips `../` traversal)
 * - When `root` is provided, rejects any path that escapes that root.
 *
 * Returns { resolved } on success, throws a 400-able Error on failure.
 */
function validatePath(inputPath: string, root?: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    throw Object.assign(new Error('path is required'), { status: 400 });
  }

  // Reject null-byte injection
  if (inputPath.includes('\0')) {
    throw Object.assign(new Error('Invalid path'), { status: 400 });
  }

  const resolved = path.resolve(inputPath);

  if (root) {
    const resolvedRoot = path.resolve(root);
    // Path must be the root itself or inside it
    if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
      throw Object.assign(
        new Error(`Path escapes allowed root: ${resolvedRoot}`),
        { status: 403 }
      );
    }
  }

  return resolved;
}

function pathError(res: Response, err: any) {
  const status = err.status || 500;
  return res.status(status).json({ error: err.message || 'Invalid path' });
}

// ─── Logging ──────────────────────────────────────────────────────────────────

function logFileOp(op: string, targetPath: string, extra?: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] FILES ${op}: ${targetPath}${extra ? ` (${extra})` : ''}`);
}

// ─── Shared constants ─────────────────────────────────────────────────────────

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

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};

const MAX_TEXT_FILE_SIZE = 1 * 1024 * 1024;    // 1 MB for text read
const MAX_IMAGE_SERVE_SIZE = 50 * 1024 * 1024; // 50 MB for image preview

function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return true;
    }
  } catch { /* assume text */ }
  return false;
}

function detectLanguage(filePath: string): string {
  const basename = path.basename(filePath).toLowerCase();
  if (basename === 'dockerfile') return 'dockerfile';
  if (basename === 'makefile') return 'makefile';
  if (basename === '.gitignore' || basename === '.dockerignore') return 'text';
  return EXT_LANGUAGE[path.extname(filePath).toLowerCase()] || 'text';
}

// ─── GET /api/files/tree ──────────────────────────────────────────────────────

router.get('/api/files/tree', (req: Request, res: Response) => {
  const rawPath = req.query.path as string;
  const rawRoot = req.query.root as string | undefined;
  const showHidden = req.query.show_hidden === 'true';

  let dirPath: string;
  try {
    dirPath = validatePath(rawPath, rawRoot);
  } catch (e) {
    return pathError(res, e);
  }

  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return res.status(400).json({ error: 'Not a directory' });
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

    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return res.json({ path: dirPath, entries });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list directory' });
  }
});

// ─── GET /api/files/read ──────────────────────────────────────────────────────

router.get('/api/files/read', (req: Request, res: Response) => {
  const rawPath = req.query.path as string;
  const rawRoot = req.query.root as string | undefined;

  let filePath: string;
  try {
    filePath = validatePath(rawPath, rawRoot);
  } catch (e) {
    return pathError(res, e);
  }

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
    if (stat.size > MAX_TEXT_FILE_SIZE) {
      return res.status(400).json({ error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Maximum is 1MB.` });
    }
    if (isBinaryFile(filePath)) return res.status(400).json({ error: 'Binary file cannot be displayed' });

    const content = fs.readFileSync(filePath, 'utf-8');
    return res.json({ path: filePath, content, language: detectLanguage(filePath), size: stat.size });
  } catch (err: any) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    return res.status(500).json({ error: err.message || 'Failed to read file' });
  }
});

// ─── GET /api/files/image ─────────────────────────────────────────────────────

router.get('/api/files/image', (req: Request, res: Response) => {
  const rawPath = req.query.path as string;
  const rawRoot = req.query.root as string | undefined;

  let filePath: string;
  try {
    filePath = validatePath(rawPath, rawRoot);
  } catch (e) {
    return pathError(res, e);
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = IMAGE_MIME[ext];
  if (!mimeType) return res.status(400).json({ error: 'Not an image file' });

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
    if (stat.size > MAX_IMAGE_SERVE_SIZE) {
      return res.status(400).json({ error: `Image too large (${(stat.size / 1024 / 1024).toFixed(0)}MB). Maximum is 50MB.` });
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=60');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', (err) => { if (!res.headersSent) res.status(500).json({ error: err.message }); });
  } catch (err: any) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    return res.status(500).json({ error: err.message || 'Failed to serve image' });
  }
});

// ─── PUT /api/files/save ──────────────────────────────────────────────────────

router.put('/api/files/save', (req: Request, res: Response) => {
  const { path: rawPath, root: rawRoot, content } = req.body;

  if (content === undefined || content === null) {
    return res.status(400).json({ error: 'content is required' });
  }

  let filePath: string;
  try {
    filePath = validatePath(rawPath, rawRoot);
  } catch (e) {
    return pathError(res, e);
  }

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
    fs.writeFileSync(filePath, content, 'utf-8');
    logFileOp('SAVE', filePath);
    return res.json({ ok: true, path: filePath, size: Buffer.byteLength(content, 'utf-8') });
  } catch (err: any) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    return res.status(500).json({ error: err.message || 'Failed to save file' });
  }
});

// ─── GET /api/files/download ──────────────────────────────────────────────────

router.get('/api/files/download', (req: Request, res: Response) => {
  const rawPath = req.query.path as string;
  const rawRoot = req.query.root as string | undefined;

  let filePath: string;
  try {
    filePath = validatePath(rawPath, rawRoot);
  } catch (e) {
    return pathError(res, e);
  }

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });

    const filename = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'application/octet-stream');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', (err) => { if (!res.headersSent) res.status(500).json({ error: err.message }); });
  } catch (err: any) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    return res.status(500).json({ error: err.message || 'Failed to download file' });
  }
});

// ─── POST /api/files/upload ───────────────────────────────────────────────────
// Supports both flat file upload and folder upload with structure preservation.
// Each file can include a `relativePath` field (from webkitRelativePath) to
// reconstruct directory hierarchy under `dir`.

router.post('/api/files/upload', (req: Request, res: Response) => {
  const rawDir = req.query.dir as string;
  const rawRoot = req.query.root as string | undefined;

  let resolvedDir: string;
  try {
    resolvedDir = validatePath(rawDir, rawRoot);
  } catch (e) {
    return pathError(res, e);
  }

  // Use memoryStorage so we can inspect fields (relativePath) before writing
  const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
  }).array('files');

  uploadMiddleware(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });

    const files = (req as any).files as (Express.Multer.File & { fieldname: string })[] | undefined;
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    // relativePaths is a parallel array matching the files array order
    const rawRelativePaths = req.body?.relativePaths;
    const relativePaths: string[] = Array.isArray(rawRelativePaths)
      ? rawRelativePaths
      : rawRelativePaths
        ? [rawRelativePaths]
        : [];

    const written: { name: string; path: string; size: number }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = relativePaths[i] || '';

      // Compute target path: if relativePath provided, preserve folder structure
      let targetPath: string;
      if (relPath) {
        // Normalise and validate the relative path (must not escape resolvedDir)
        const safeParts = relPath.split(/[/\\]/)
          .filter((p) => p && p !== '..' && p !== '.');
        targetPath = path.join(resolvedDir, ...safeParts);
      } else {
        targetPath = path.join(resolvedDir, path.basename(file.originalname));
      }

      // Final safety check: resolved target must still be inside resolvedDir
      const resolvedTarget = path.resolve(targetPath);
      if (resolvedTarget !== resolvedDir && !resolvedTarget.startsWith(resolvedDir + path.sep)) {
        return res.status(403).json({ error: `Upload path escapes target directory: ${relPath}` });
      }

      const targetDir = path.dirname(resolvedTarget);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(resolvedTarget, file.buffer);
      written.push({ name: file.originalname, path: resolvedTarget, size: file.size });
    }

    logFileOp('UPLOAD', resolvedDir, `${written.length} file(s): ${written.map(f => f.name).join(', ')}`);
    return res.json({ uploaded: written });
  });
});

// ─── POST /api/files/create ───────────────────────────────────────────────────

router.post('/api/files/create', (req: Request, res: Response) => {
  const { path: rawPath, root: rawRoot, type, content = '' } = req.body;

  if (!['file', 'dir'].includes(type)) {
    return res.status(400).json({ error: 'type must be "file" or "dir"' });
  }

  let targetPath: string;
  try {
    targetPath = validatePath(rawPath, rawRoot);
  } catch (e) {
    return pathError(res, e);
  }

  if (fs.existsSync(targetPath)) return res.status(409).json({ error: 'Path already exists' });

  try {
    if (type === 'dir') {
      fs.mkdirSync(targetPath, { recursive: true });
    } else {
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(targetPath, content, 'utf-8');
    }
    logFileOp('CREATE', targetPath, type);
    return res.json({ path: targetPath, type });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create' });
  }
});

// ─── DELETE /api/files ────────────────────────────────────────────────────────

router.delete('/api/files', (req: Request, res: Response) => {
  const rawPath = req.query.path as string;
  const rawRoot = req.query.root as string | undefined;

  let targetPath: string;
  try {
    targetPath = validatePath(rawPath, rawRoot);
  } catch (e) {
    return pathError(res, e);
  }

  try {
    const stat = fs.statSync(targetPath);
    const type = stat.isDirectory() ? 'dir' : 'file';
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    logFileOp('DELETE', targetPath, type);
    return res.json({ ok: true, path: targetPath });
  } catch (err: any) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Path not found' });
    return res.status(500).json({ error: err.message || 'Failed to delete' });
  }
});

// ─── PATCH /api/files/rename ──────────────────────────────────────────────────

router.patch('/api/files/rename', (req: Request, res: Response) => {
  const { path: rawPath, root: rawRoot, newName } = req.body;

  if (!newName || typeof newName !== 'string') {
    return res.status(400).json({ error: 'newName is required' });
  }
  // newName must be a plain filename — no separators, no traversal
  if (newName.includes('/') || newName.includes('\\') || newName.includes('\0') || newName === '..' || newName === '.') {
    return res.status(400).json({ error: 'newName must be a plain filename with no path separators' });
  }

  let targetPath: string;
  try {
    targetPath = validatePath(rawPath, rawRoot);
  } catch (e) {
    return pathError(res, e);
  }

  try {
    if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'Path not found' });
    const parentDir = path.dirname(targetPath);
    const newPath = path.join(parentDir, newName);
    if (fs.existsSync(newPath)) return res.status(409).json({ error: 'A file with that name already exists' });
    fs.renameSync(targetPath, newPath);
    logFileOp('RENAME', targetPath, `→ ${newName}`);
    return res.json({ ok: true, path: newPath });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to rename' });
  }
});

export default router;
