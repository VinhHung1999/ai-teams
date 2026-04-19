/**
 * Node MCP server — ai-teams
 * Replaces broken Python MCP server (postgres dependency removed).
 * Exposes: notify_boss, send_to_team_chat
 * Communicates via stdio; proxies to localhost:17070 HTTP API.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE = 'http://localhost:17070';

const server = new Server(
  { name: 'ai-teams', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'notify_boss',
      description:
        'Send a notification to the Boss (human user) via the board UI. Use when: sprint is done and needs review, you are blocked and need help, important decision required, or significant milestone reached.',
      inputSchema: {
        type: 'object',
        properties: {
          session_name: { type: 'string', description: 'Tmux session name (= project identifier)' },
          message: { type: 'string', description: 'Notification message for the Boss' },
          from_role: { type: 'string', description: 'Your role name (PO, DEV, etc.)' },
          urgency: {
            type: 'string',
            enum: ['low', 'normal', 'high'],
            description: 'Urgency level (default: normal). Use "high" for blockers.',
          },
        },
        required: ['session_name', 'message'],
      },
    },
    {
      name: 'send_to_team_chat',
      description:
        'Post a message to the team\'s Telegram group chat. Use this to reply conversationally when a message came from the group (prefix "[via Telegram]"). Keep notify_boss for urgent DM push to Boss.',
      inputSchema: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Tmux session_name of the team — use underscore form (e.g. "ai_teams", "love_scrum"), NOT project name with hyphens' },
          message: { type: 'string', description: 'Message text to post in the group' },
          reply_to_message_id: { type: 'integer', description: 'Optional Telegram message_id to quote/reply to' },
        },
        required: ['team', 'message'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === 'notify_boss') {
    const { session_name, message, from_role, urgency } = args as any;
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_name, message, from_role, urgency: urgency ?? 'normal' }),
      });
      const data = await res.json() as any;
      if (res.ok) {
        return { content: [{ type: 'text', text: `Notification sent to Boss: '${message}' [${urgency ?? 'normal'}]` }] };
      }
      return { content: [{ type: 'text', text: `Failed to notify Boss: ${data.error ?? res.statusText}` }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: `Notification error: ${e.message}` }] };
    }
  }

  if (name === 'send_to_team_chat') {
    const { team, message, reply_to_message_id } = args as any;
    try {
      const res = await fetch(`${API_BASE}/api/telegram/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team, message, reply_to_message_id }),
      });
      const data = await res.json() as any;
      if (res.ok) {
        return { content: [{ type: 'text', text: `Message sent to team '${team}' Telegram group.` }] };
      }
      return { content: [{ type: 'text', text: `Failed: ${data.error ?? res.statusText}` }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: `send_to_team_chat error: ${e.message}` }] };
    }
  }

  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error('[mcp] Fatal:', e);
  process.exit(1);
});
