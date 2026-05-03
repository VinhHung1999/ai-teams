import fs from 'fs';
import path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Project {
  id: number;
  name: string;
  tmux_session_name: string | null;
  working_directory: string | null;
  board_directory?: string;
  pinned?: boolean;
  created_at: string;
  telegram_chat_id?: number;
}

export interface Notification {
  id: number;
  project_id: number;
  session_name: string | null;
  from_role: string | null;
  message: string;
  urgency: string;
  read: boolean;
  created_at: string;
}

interface Registry {
  projects: Project[];
  nextProjectId: number;
  nextNotificationId: number;
  notifications: Notification[];
}

// ── JsonStorage ────────────────────────────────────────────────────────────────

const DEFAULT_PATH = path.join(__dirname, '..', '..', 'data', 'registry.json');

class JsonStorage {
  private readonly filePath: string;
  private registry: Registry;

  constructor(filePath?: string) {
    this.filePath = filePath ?? DEFAULT_PATH;
    this.registry = this.load();
  }

  private load(): Registry {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as Registry;
    } catch {
      return { projects: [], nextProjectId: 1, nextNotificationId: 1, notifications: [] };
    }
  }

  private save(): void {
    const tmp = this.filePath + '.tmp.' + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(this.registry, null, 2), 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }

  // ── Projects ──────────────────────────────────────────────────────────────

  getProjects(): Project[] {
    return [...this.registry.projects];
  }

  getProject(id: number): Project | null {
    return this.registry.projects.find(p => p.id === id) ?? null;
  }

  getProjectBySession(sessionName: string): Project | null {
    return this.registry.projects.find(p => p.tmux_session_name === sessionName) ?? null;
  }

  createProject(data: Omit<Project, 'id' | 'created_at'>): Project {
    const id = this.registry.nextProjectId++;
    const project: Project = {
      id,
      name: data.name,
      tmux_session_name: data.tmux_session_name ?? null,
      working_directory: data.working_directory ?? null,
      pinned: false,
      created_at: new Date().toISOString(),
    };
    this.registry.projects.push(project);
    this.save();
    return project;
  }

  updateProject(id: number, patch: Partial<Project>): Project | null {
    const p = this.registry.projects.find(p => p.id === id);
    if (!p) return null;
    Object.assign(p, patch);
    this.save();
    return p;
  }

  deleteProject(id: number): boolean {
    const idx = this.registry.projects.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.registry.projects.splice(idx, 1);
    this.registry.notifications = this.registry.notifications.filter(n => n.project_id !== id);
    this.save();
    return true;
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  listNotifications(opts?: { projectId?: number; unreadOnly?: boolean; limit?: number }): Notification[] {
    let list = [...this.registry.notifications];
    if (opts?.projectId !== undefined) {
      list = list.filter(n => n.project_id === opts.projectId);
    }
    if (opts?.unreadOnly) {
      list = list.filter(n => !n.read);
    }
    // notifications stored newest-first
    if (opts?.limit) {
      list = list.slice(0, opts.limit);
    }
    return list;
  }

  createNotification(data: Omit<Notification, 'id' | 'created_at' | 'read'>): Notification {
    const id = this.registry.nextNotificationId++;
    const notif: Notification = {
      id,
      project_id: data.project_id,
      session_name: data.session_name ?? null,
      from_role: data.from_role ?? null,
      message: data.message,
      urgency: data.urgency ?? 'normal',
      read: false,
      created_at: new Date().toISOString(),
    };
    this.registry.notifications.unshift(notif); // newest first
    this.save();
    return notif;
  }

  markRead(id: number): boolean {
    const n = this.registry.notifications.find(n => n.id === id);
    if (!n) return false;
    n.read = true;
    this.save();
    return true;
  }

  markAllRead(projectId?: number): number {
    let count = 0;
    for (const n of this.registry.notifications) {
      if (n.read) continue;
      if (projectId !== undefined && n.project_id !== projectId) continue;
      n.read = true;
      count++;
    }
    if (count > 0) this.save();
    return count;
  }
}

export const storage = new JsonStorage();
export default storage;
