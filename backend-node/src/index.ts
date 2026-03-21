import express from 'express';
import cors from 'cors';
import expressWs from 'express-ws';

const { app } = expressWs(express());

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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Import routes
import projectsRouter from './routes/projects';
import backlogRouter from './routes/backlog';
import sprintsRouter from './routes/sprints';
import boardRouter from './routes/board';
import { registerTerminalWs } from './routes/terminal';
import tmuxRouter from './routes/tmux';

app.use(projectsRouter);
app.use(backlogRouter);
app.use(sprintsRouter);
app.use(boardRouter);
registerTerminalWs(app);
app.use(tmuxRouter);

const PORT = 17070;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Teams backend running on http://0.0.0.0:${PORT}`);
});
