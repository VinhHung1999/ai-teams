import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();
const SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills');
const CACHE_TTL = 60_000;

interface Skill {
  name: string;
  description: string;
  folder: string;
}

let skillsCache: { fetchedAt: number; data: Skill[] } | null = null;

function parseSkillMd(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = match[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  return { name, description };
}

function loadSkills(): Skill[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  const skills: Skill[] = [];

  // Check for .md files directly in SKILLS_DIR
  for (const entry of fs.readdirSync(SKILLS_DIR)) {
    const entryPath = path.join(SKILLS_DIR, entry);
    const stat = fs.statSync(entryPath);

    if (stat.isDirectory()) {
      const skillMd = path.join(entryPath, 'SKILL.md');
      if (fs.existsSync(skillMd)) {
        const parsed = parseSkillMd(fs.readFileSync(skillMd, 'utf-8'));
        if (parsed.name) {
          skills.push({ name: parsed.name, description: parsed.description ?? '', folder: entry });
        }
      }
    } else if (entry.endsWith('.md')) {
      const parsed = parseSkillMd(fs.readFileSync(entryPath, 'utf-8'));
      if (parsed.name) {
        skills.push({ name: parsed.name, description: parsed.description ?? '', folder: entry.replace(/\.md$/, '') });
      }
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

// GET /api/skills — list all Claude skills from ~/.claude/skills/, 60s cache
router.get('/api/skills', (_req: Request, res: Response) => {
  if (skillsCache && Date.now() - skillsCache.fetchedAt < CACHE_TTL) {
    return res.json(skillsCache.data);
  }
  try {
    const data = loadSkills();
    skillsCache = { fetchedAt: Date.now(), data };
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
