export type ChatRole = 'PO' | 'DEV' | 'BOSS';
export type ChatKind = 'message' | 'tool_use' | 'tool_result';

export interface ChatEvent {
  id: string;
  role: ChatRole;
  targetRole?: 'PO' | 'DEV'; // for BOSS messages: which pane's JSONL this came from
  sessionId: string;
  timestamp: string;
  kind: ChatKind;
  text?: string;
  pending?: boolean; // [367] queued but not yet processed by agent
  tool?: {
    name: string;
    input?: any;
    output?: any;
    isError?: boolean;
    toolUseId?: string;
  };
}
