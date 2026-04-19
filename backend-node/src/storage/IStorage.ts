import {
  Project, BacklogItem, Sprint, SprintItem,
  SprintItemWithBacklog, Notification, DashboardData,
} from './types';

export interface IStorage {
  // ── Projects ──────────────────────────────────────────────
  listProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | null>;
  findProjectBySession(sessionName: string): Promise<Project | null>;
  findProjectByChatId(chatId: number): Promise<Project | null>;
  updateProjectTelegramChatId(projectId: number, chatId: number): Promise<void>;
  createProject(data: {
    name: string;
    tmux_session_name?: string | null;
    working_directory?: string | null;
  }): Promise<Project>;
  updateProject(id: number, data: Partial<Pick<Project, 'name' | 'tmux_session_name' | 'working_directory' | 'pinned'>>): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  // ── Backlog ────────────────────────────────────────────────
  listBacklog(projectId: number): Promise<BacklogItem[]>;
  getBacklogItem(id: number): Promise<BacklogItem | null>;
  createBacklogItem(projectId: number, data: {
    title: string;
    description?: string | null;
    priority?: string;
    story_points?: number | null;
    acceptance_criteria?: unknown;
  }): Promise<BacklogItem>;
  updateBacklogItem(id: number, data: Partial<{
    title: string;
    description: string | null;
    priority: string;
    story_points: number | null;
    acceptance_criteria: unknown;
    status: string;
    order: number;
  }>): Promise<BacklogItem>;
  deleteBacklogItem(id: number): Promise<void>;
  reorderBacklog(projectId: number, itemIds: number[]): Promise<void>;

  // ── Sprints ────────────────────────────────────────────────
  listSprints(projectId: number): Promise<Sprint[]>;
  getSprint(id: number): Promise<Sprint | null>;
  findActiveSprint(projectId: number): Promise<Sprint | null>;
  createSprint(projectId: number, data: { goal?: string | null }): Promise<Sprint>;
  updateSprint(id: number, data: Partial<{
    status: string;
    started_at: string | null;
    completed_at: string | null;
    goal: string | null;
  }>): Promise<Sprint>;
  deleteSprint(id: number): Promise<void>;

  // ── Sprint Items ───────────────────────────────────────────
  listSprintItems(sprintId: number): Promise<SprintItemWithBacklog[]>;
  listSprintItemsRaw(sprintId: number): Promise<SprintItem[]>;
  getSprintItem(id: number, sprintId?: number): Promise<SprintItemWithBacklog | null>;
  getSprintItemRaw(id: number): Promise<SprintItem | null>;
  createSprintItem(sprintId: number, data: {
    backlog_item_id: number;
    assignee_role?: string | null;
  }): Promise<SprintItem>;
  updateSprintItem(id: number, data: Partial<{
    board_status: string;
    order: number;
    assignee_role: string | null;
    notes: string | null;
  }>): Promise<SprintItem>;
  deleteSprintItem(id: number): Promise<void>;
  deleteSprintItemsBySprintId(sprintId: number): Promise<void>;

  // ── Notifications ──────────────────────────────────────────
  createNotification(data: {
    project_id: number;
    session_name: string;
    from_role?: string | null;
    message: string;
    urgency?: string;
  }): Promise<Notification>;
  listNotifications(projectId: number, unreadOnly?: boolean): Promise<Notification[]>;
  markAllNotificationsRead(projectId: number): Promise<void>;

  // ── Dashboard (composite) ─────────────────────────────────
  getDashboard(projectId: number): Promise<DashboardData | null>;
}
