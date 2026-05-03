export type ChatRole = 'PO' | 'DEV' | 'BOSS';
export type ChatKind = 'message' | 'tool_use' | 'tool_result';

export interface ChatEvent {
  id: string;
  role: ChatRole;
  sessionId: string;
  timestamp: string;
  kind: ChatKind;
  text?: string;
  tool?: {
    name: string;
    input?: any;
    output?: any;
    isError?: boolean;
    toolUseId?: string;
  };
}
