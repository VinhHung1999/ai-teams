import { PrismaClient } from '@prisma/client';
import { IStorage } from './IStorage';
import {
  Project, BacklogItem, Sprint, SprintItem,
  SprintItemWithBacklog, Notification, DashboardData,
} from './types';

const BOARD_COLUMNS = ['todo', 'in_progress', 'in_review', 'testing', 'done'];

function fmtProject(p: any): Project {
  return {
    id: p.id,
    name: p.name,
    tmux_session_name: p.tmux_session_name,
    working_directory: p.working_directory,
    pinned: p.pinned,
    created_at: p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at,
  };
}

function fmtBacklogItem(i: any): BacklogItem {
  return {
    id: i.id,
    project_id: i.project_id,
    title: i.title,
    description: i.description,
    priority: i.priority,
    story_points: i.story_points,
    acceptance_criteria: i.acceptance_criteria,
    status: i.status,
    order: i.order,
    created_at: i.created_at instanceof Date ? i.created_at.toISOString() : i.created_at,
    updated_at: i.updated_at instanceof Date ? i.updated_at.toISOString() : i.updated_at,
  };
}

function fmtSprint(s: any): Sprint {
  return {
    id: s.id,
    project_id: s.project_id,
    number: s.number,
    goal: s.goal,
    status: s.status,
    started_at: s.started_at instanceof Date ? s.started_at.toISOString() : s.started_at ?? null,
    completed_at: s.completed_at instanceof Date ? s.completed_at.toISOString() : s.completed_at ?? null,
    created_at: s.created_at instanceof Date ? s.created_at.toISOString() : s.created_at,
  };
}

function fmtSprintItem(si: any): SprintItem {
  return {
    id: si.id,
    sprint_id: si.sprint_id,
    backlog_item_id: si.backlog_item_id,
    assignee_role: si.assignee_role,
    board_status: si.board_status,
    order: si.order,
    notes: si.notes ?? null,
    updated_at: si.updated_at instanceof Date ? si.updated_at.toISOString() : si.updated_at,
  };
}

function fmtSprintItemWithBacklog(si: any): SprintItemWithBacklog {
  return {
    ...fmtSprintItem(si),
    backlog_item: fmtBacklogItem(si.backlog_item),
  };
}

export class PostgresStorage implements IStorage {
  constructor(private prisma: PrismaClient) {}

  // ── Projects ──────────────────────────────────────────────

  async listProjects(): Promise<Project[]> {
    const rows = await this.prisma.project.findMany({
      orderBy: [{ pinned: 'desc' }, { created_at: 'desc' }],
    });
    return rows.map(fmtProject);
  }

  async getProject(id: number): Promise<Project | null> {
    const p = await this.prisma.project.findUnique({ where: { id } });
    return p ? fmtProject(p) : null;
  }

  async findProjectBySession(sessionName: string): Promise<Project | null> {
    const p = await this.prisma.project.findFirst({
      where: { tmux_session_name: sessionName },
    });
    return p ? fmtProject(p) : null;
  }

  async createProject(data: {
    name: string;
    tmux_session_name?: string | null;
    working_directory?: string | null;
  }): Promise<Project> {
    const p = await this.prisma.project.create({
      data: {
        name: data.name,
        tmux_session_name: data.tmux_session_name ?? null,
        working_directory: data.working_directory ?? null,
      },
    });
    return fmtProject(p);
  }

  async updateProject(id: number, data: Partial<Pick<Project, 'name' | 'tmux_session_name' | 'working_directory' | 'pinned'>>): Promise<Project> {
    const p = await this.prisma.project.update({ where: { id }, data });
    return fmtProject(p);
  }

  async deleteProject(id: number): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  // ── Backlog ────────────────────────────────────────────────

  async listBacklog(projectId: number): Promise<BacklogItem[]> {
    const rows = await this.prisma.backlogItem.findMany({
      where: { project_id: projectId },
      orderBy: { order: 'asc' },
    });
    return rows.map(fmtBacklogItem);
  }

  async getBacklogItem(id: number): Promise<BacklogItem | null> {
    const item = await this.prisma.backlogItem.findUnique({ where: { id } });
    return item ? fmtBacklogItem(item) : null;
  }

  async createBacklogItem(projectId: number, data: {
    title: string;
    description?: string | null;
    priority?: string;
    story_points?: number | null;
    acceptance_criteria?: unknown;
  }): Promise<BacklogItem> {
    const maxResult = await this.prisma.backlogItem.findFirst({
      where: { project_id: projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const maxOrder = maxResult?.order ?? 0;

    const item = await this.prisma.backlogItem.create({
      data: {
        project_id: projectId,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority ?? 'P2',
        story_points: data.story_points ?? null,
        acceptance_criteria: (data.acceptance_criteria as any) ?? undefined,
        order: maxOrder + 1,
      },
    });
    return fmtBacklogItem(item);
  }

  async updateBacklogItem(id: number, data: Partial<{
    title: string;
    description: string | null;
    priority: string;
    story_points: number | null;
    acceptance_criteria: unknown;
    status: string;
    order: number;
  }>): Promise<BacklogItem> {
    const item = await this.prisma.backlogItem.update({ where: { id }, data: data as any });
    return fmtBacklogItem(item);
  }

  async deleteBacklogItem(id: number): Promise<void> {
    await this.prisma.backlogItem.delete({ where: { id } });
  }

  async reorderBacklog(projectId: number, itemIds: number[]): Promise<void> {
    for (let idx = 0; idx < itemIds.length; idx++) {
      await this.prisma.backlogItem.updateMany({
        where: { id: itemIds[idx], project_id: projectId },
        data: { order: idx },
      });
    }
  }

  // ── Sprints ────────────────────────────────────────────────

  async listSprints(projectId: number): Promise<Sprint[]> {
    const rows = await this.prisma.sprint.findMany({
      where: { project_id: projectId },
      orderBy: { number: 'desc' },
    });
    return rows.map(fmtSprint);
  }

  async getSprint(id: number): Promise<Sprint | null> {
    const s = await this.prisma.sprint.findUnique({ where: { id } });
    return s ? fmtSprint(s) : null;
  }

  async findActiveSprint(projectId: number): Promise<Sprint | null> {
    const s = await this.prisma.sprint.findFirst({
      where: { project_id: projectId, status: 'active' },
    });
    return s ? fmtSprint(s) : null;
  }

  async createSprint(projectId: number, data: { goal?: string | null }): Promise<Sprint> {
    const maxResult = await this.prisma.sprint.aggregate({
      where: { project_id: projectId },
      _max: { number: true },
    });
    const maxNum = maxResult._max.number ?? 0;

    const s = await this.prisma.sprint.create({
      data: {
        project_id: projectId,
        number: maxNum + 1,
        goal: data.goal ?? null,
      },
    });
    return fmtSprint(s);
  }

  async updateSprint(id: number, data: Partial<{
    status: string;
    started_at: string | null;
    completed_at: string | null;
    goal: string | null;
  }>): Promise<Sprint> {
    const updateData: any = { ...data };
    if (data.started_at !== undefined) {
      updateData.started_at = data.started_at ? new Date(data.started_at) : null;
    }
    if (data.completed_at !== undefined) {
      updateData.completed_at = data.completed_at ? new Date(data.completed_at) : null;
    }
    const s = await this.prisma.sprint.update({ where: { id }, data: updateData });
    return fmtSprint(s);
  }

  async deleteSprint(id: number): Promise<void> {
    await this.prisma.sprint.delete({ where: { id } });
  }

  // ── Sprint Items ───────────────────────────────────────────

  async listSprintItems(sprintId: number): Promise<SprintItemWithBacklog[]> {
    const rows = await this.prisma.sprintItem.findMany({
      where: { sprint_id: sprintId },
      include: { backlog_item: true },
      orderBy: { order: 'asc' },
    });
    return rows.map(fmtSprintItemWithBacklog);
  }

  async listSprintItemsRaw(sprintId: number): Promise<SprintItem[]> {
    const rows = await this.prisma.sprintItem.findMany({
      where: { sprint_id: sprintId },
    });
    return rows.map(fmtSprintItem);
  }

  async getSprintItem(id: number, _sprintId?: number): Promise<SprintItemWithBacklog | null> {
    const si = await this.prisma.sprintItem.findUnique({
      where: { id },
      include: { backlog_item: true },
    });
    return si ? fmtSprintItemWithBacklog(si) : null;
  }

  async getSprintItemRaw(id: number): Promise<SprintItem | null> {
    const si = await this.prisma.sprintItem.findUnique({ where: { id } });
    return si ? fmtSprintItem(si) : null;
  }

  async createSprintItem(sprintId: number, data: {
    backlog_item_id: number;
    assignee_role?: string | null;
  }): Promise<SprintItem> {
    const maxResult = await this.prisma.sprintItem.aggregate({
      where: { sprint_id: sprintId },
      _max: { order: true },
    });
    const maxOrder = maxResult._max.order ?? 0;

    const si = await this.prisma.sprintItem.create({
      data: {
        sprint_id: sprintId,
        backlog_item_id: data.backlog_item_id,
        assignee_role: data.assignee_role ?? null,
        order: maxOrder + 1,
      },
    });
    return fmtSprintItem(si);
  }

  async updateSprintItem(id: number, data: Partial<{
    board_status: string;
    order: number;
    assignee_role: string | null;
    notes: string | null;
  }>): Promise<SprintItem> {
    const si = await this.prisma.sprintItem.update({ where: { id }, data });
    return fmtSprintItem(si);
  }

  async deleteSprintItem(id: number): Promise<void> {
    await this.prisma.sprintItem.delete({ where: { id } });
  }

  async deleteSprintItemsBySprintId(sprintId: number): Promise<void> {
    await this.prisma.sprintItem.deleteMany({ where: { sprint_id: sprintId } });
  }

  // ── Notifications ──────────────────────────────────────────

  async createNotification(data: {
    project_id: number;
    session_name: string;
    from_role?: string | null;
    message: string;
    urgency?: string;
  }): Promise<Notification> {
    const n = await this.prisma.notification.create({
      data: {
        project_id: data.project_id,
        session_name: data.session_name,
        from_role: data.from_role ?? null,
        message: data.message,
        urgency: data.urgency ?? 'normal',
      },
    });
    return {
      id: n.id,
      project_id: n.project_id,
      session_name: n.session_name,
      from_role: n.from_role,
      message: n.message,
      urgency: n.urgency,
      read: n.read,
      created_at: n.created_at.toISOString(),
    };
  }

  async listNotifications(projectId: number, unreadOnly?: boolean): Promise<Notification[]> {
    const where: any = { project_id: projectId };
    if (unreadOnly) where.read = false;
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return rows.map(n => ({
      id: n.id,
      project_id: n.project_id,
      session_name: n.session_name,
      from_role: n.from_role,
      message: n.message,
      urgency: n.urgency,
      read: n.read,
      created_at: n.created_at.toISOString(),
    }));
  }

  async markAllNotificationsRead(projectId: number): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { project_id: projectId, read: false },
      data: { read: true },
    });
  }

  // ── Dashboard ──────────────────────────────────────────────

  async getDashboard(projectId: number): Promise<DashboardData | null> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return null;

    const sprints = await this.prisma.sprint.findMany({
      where: { project_id: projectId },
      orderBy: { number: 'desc' },
    });
    const backlogItems = await this.prisma.backlogItem.findMany({
      where: { project_id: projectId },
      orderBy: { order: 'asc' },
    });
    const sprintIds = sprints.map(s => s.id);
    const boards: Record<string, Record<string, SprintItemWithBacklog[]>> = {};

    if (sprintIds.length > 0) {
      const allItems = await this.prisma.sprintItem.findMany({
        where: { sprint_id: { in: sprintIds } },
        include: { backlog_item: true },
        orderBy: { order: 'asc' },
      });
      for (const si of allItems) {
        const sid = String(si.sprint_id);
        if (!boards[sid]) {
          boards[sid] = {};
          for (const col of BOARD_COLUMNS) boards[sid][col] = [];
        }
        boards[sid][si.board_status].push(fmtSprintItemWithBacklog(si));
      }
    }

    return {
      project: {
        id: project.id,
        name: project.name,
        tmux_session_name: project.tmux_session_name,
        working_directory: project.working_directory,
        created_at: project.created_at?.toISOString() ?? new Date().toISOString(),
      },
      sprints: sprints.map(fmtSprint),
      backlog: backlogItems.map(fmtBacklogItem),
      boards,
    };
  }
}
