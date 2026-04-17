export interface Project {
  id: number;
  name: string;
  tmux_session_name: string | null;
  working_directory: string | null;
  board_directory?: string;
  pinned: boolean;
  created_at: string; // ISO string
}

export interface BacklogItem {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  priority: string;
  story_points: number | null;
  acceptance_criteria: unknown;
  status: string;
  order: number;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

export interface Sprint {
  id: number;
  project_id: number;
  number: number;
  goal: string | null;
  status: string; // planning | active | completed
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SprintItem {
  id: number;
  sprint_id: number;
  backlog_item_id: number;
  assignee_role: string | null;
  board_status: string; // todo | in_progress | in_review | testing | done
  order: number;
  notes: string | null;
  updated_at: string;
}

export interface SprintItemWithBacklog extends SprintItem {
  backlog_item: BacklogItem;
}

export interface Notification {
  id: number;
  project_id: number;
  session_name: string;
  from_role: string | null;
  message: string;
  urgency: string;
  read: boolean;
  created_at: string;
}

export type DashboardData = {
  project: Pick<Project, 'id' | 'name' | 'tmux_session_name' | 'working_directory' | 'created_at'>;
  sprints: Sprint[];
  backlog: BacklogItem[];
  boards: Record<string, Record<string, SprintItemWithBacklog[]>>;
};
