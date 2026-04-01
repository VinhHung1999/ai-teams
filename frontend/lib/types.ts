export interface Project {
  id: number;
  name: string;
  tmux_session_name: string | null;
  working_directory: string | null;
  created_at: string;
  // Enriched fields returned by GET /api/projects/:id (not present in list)
  has_setup_file?: boolean;
  setup_file_path?: string;
  tmux_active?: boolean;
  roles?: string[];
}

export interface BacklogItem {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  priority: string;
  story_points: number | null;
  acceptance_criteria: Record<string, unknown> | null;
  status: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface Sprint {
  id: number;
  project_id: number;
  number: number;
  goal: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SprintItem {
  id: number;
  sprint_id: number;
  backlog_item_id: number;
  assignee_role: string | null;
  board_status: string;
  order: number;
}

export interface BoardItem {
  id: number;
  sprint_id: number;
  backlog_item_id: number;
  title: string;
  description: string | null;
  priority: string;
  story_points: number | null;
  assignee_role: string | null;
  board_status: string;
  order: number;
}

export type BoardColumn = "todo" | "in_progress" | "in_review" | "testing" | "done";

export type Board = Record<BoardColumn, BoardItem[]>;

export const BOARD_COLUMNS: { key: BoardColumn; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "in_review", label: "In Review" },
  { key: "testing", label: "Testing" },
  { key: "done", label: "Done" },
];

export const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export const ROLES = ["PO", "TL", "BE", "FE", "QA", "SM"] as const;
