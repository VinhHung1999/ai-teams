const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API error");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Projects
export const api = {
  // Projects
  listProjects: () => fetchAPI<import("./types").Project[]>("/api/projects"),
  createProject: (data: { name: string; tmux_session_name?: string; working_directory?: string }) =>
    fetchAPI<import("./types").Project>("/api/projects", { method: "POST", body: JSON.stringify(data) }),
  getProject: (id: number) => fetchAPI<import("./types").Project>(`/api/projects/${id}`),
  deleteProject: (id: number) => fetchAPI<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
  browseDirs: (path?: string) =>
    fetchAPI<{ current: string; parent: string; dirs: { name: string; path: string }[] }>(
      `/api/projects/browse-dirs${path ? `?path=${encodeURIComponent(path)}` : ""}`
    ),

  // Backlog
  listBacklog: (projectId: number) =>
    fetchAPI<import("./types").BacklogItem[]>(`/api/projects/${projectId}/backlog`),
  createBacklogItem: (projectId: number, data: { title: string; description?: string; priority?: string; story_points?: number }) =>
    fetchAPI<import("./types").BacklogItem>(`/api/projects/${projectId}/backlog`, { method: "POST", body: JSON.stringify(data) }),
  updateBacklogItem: (itemId: number, data: Partial<import("./types").BacklogItem>) =>
    fetchAPI<import("./types").BacklogItem>(`/api/backlog/${itemId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteBacklogItem: (itemId: number) =>
    fetchAPI<{ ok: boolean }>(`/api/backlog/${itemId}`, { method: "DELETE" }),
  reorderBacklog: (projectId: number, itemIds: number[]) =>
    fetchAPI<{ ok: boolean }>(`/api/projects/${projectId}/backlog/reorder`, { method: "PUT", body: JSON.stringify({ item_ids: itemIds }) }),

  // Sprints
  listSprints: (projectId: number) =>
    fetchAPI<import("./types").Sprint[]>(`/api/projects/${projectId}/sprints`),
  createSprint: (projectId: number, data: { goal?: string }) =>
    fetchAPI<import("./types").Sprint>(`/api/projects/${projectId}/sprints`, { method: "POST", body: JSON.stringify(data) }),
  startSprint: (sprintId: number) =>
    fetchAPI<import("./types").Sprint>(`/api/sprints/${sprintId}/start`, { method: "PUT" }),
  completeSprint: (sprintId: number) =>
    fetchAPI<import("./types").Sprint>(`/api/sprints/${sprintId}/complete`, { method: "PUT" }),
  deleteSprint: (sprintId: number) =>
    fetchAPI<{ ok: boolean }>(`/api/sprints/${sprintId}`, { method: "DELETE" }),
  addItemToSprint: (sprintId: number, data: { backlog_item_id: number; assignee_role?: string }) =>
    fetchAPI<import("./types").SprintItem>(`/api/sprints/${sprintId}/items`, { method: "POST", body: JSON.stringify(data) }),
  removeItemFromSprint: (sprintId: number, itemId: number) =>
    fetchAPI<{ ok: boolean }>(`/api/sprints/${sprintId}/items/${itemId}`, { method: "DELETE" }),

  // Board
  getBoard: (sprintId: number) =>
    fetchAPI<import("./types").Board>(`/api/sprints/${sprintId}/board`),
  moveItem: (itemId: number, data: { board_status: string; order?: number }) =>
    fetchAPI<{ ok: boolean }>(`/api/board/items/${itemId}/move`, { method: "PUT", body: JSON.stringify(data) }),
};
