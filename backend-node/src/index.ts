import express from 'express';
import cors from 'cors';
import http from 'http';
import { URL } from 'url';
import { registerTerminalWs, listSessions, killSession } from './routes/terminal';

const app = express();
const server = http.createServer(app);

// ─── Logging ───
function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}
function logErr(msg: string, err?: any) {
  console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, err?.message || err || '');
}

// Catch uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  logErr('Uncaught exception', err);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
  logErr('Unhandled rejection', reason);
});

// CORS configuration
const allowedOrigins = [
  'http://localhost:3340',
  'https://scrum-team.hungphu.work',
  'https://scrum-api.hungphu.work',
];
const originRegex = /https:\/\/.*\.(trycloudflare\.com|hungphu\.work)/;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || originRegex.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['*'],
}));

app.use(express.json());

// Request logging for slow requests
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 3000) {
      log(`SLOW ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logErr(`Express error: ${_req.method} ${_req.url}`, err);
  res.status(500).json({ error: 'Internal server error' });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), memory: process.memoryUsage().rss });
});

// Import routes
import projectsRouter from './routes/projects';
import backlogRouter from './routes/backlog';
import sprintsRouter from './routes/sprints';
import boardRouter from './routes/board';
import tmuxRouter from './routes/tmux';
import filesRouter from './routes/files';
import gitRouter from './routes/git';
import notificationsRouter from './routes/notifications';

app.use(projectsRouter);
app.use(backlogRouter);
app.use(sprintsRouter);
app.use(boardRouter);
app.use(tmuxRouter);
app.use(filesRouter);
app.use(gitRouter);
app.use(notificationsRouter);

// Terminal REST endpoints
app.get('/api/terminal/sessions', (_req, res) => {
  res.json(listSessions());
});
app.delete('/api/terminal/sessions/:name', (req, res) => {
  res.json({ ok: killSession(req.params.name) });
});

// WebSocket terminal - use raw ws on HTTP server upgrade
registerTerminalWs(server);

const PORT = 17070;
server.listen(PORT, '0.0.0.0', () => {
  log(`AI Teams backend running on http://0.0.0.0:${PORT} (PID: ${process.pid})`);
});

// Graceful shutdown - close server so port is freed immediately
function shutdown(signal: string) {
  log(`Received ${signal}, shutting down...`);
  server.close(() => {
    log('Server closed, exiting.');
    process.exit(0);
  });
  setTimeout(() => {
    logErr('Forced exit after timeout');
    process.exit(1);
  }, 3000);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
