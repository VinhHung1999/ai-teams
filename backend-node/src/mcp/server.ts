/**
 * Node MCP server — ai-teams
 * Replaces broken Python MCP server (postgres dependency removed).
 * Exposes: notify_boss (with optional image_path for outbound photos)
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
          image_path: {
            type: 'string',
            description: 'Optional absolute local path to an image file to send along with the message. If provided, image is sent via Telegram sendPhoto with message as caption.',
          },
        },
        required: ['session_name', 'message'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === 'notify_boss') {
    const { session_name, message, from_role, urgency, image_path } = args as any;
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_name, message, from_role, urgency: urgency ?? 'normal', image_path }),
      });
      const data = await res.json() as any;
      if (res.ok) {
        const suffix = image_path ? ' (with image)' : '';
        return { content: [{ type: 'text', text: `Notification sent to Boss: '${message}' [${urgency ?? 'normal'}]${suffix}` }] };
      }
      return { content: [{ type: 'text', text: `Failed to notify Boss: ${data.error ?? res.statusText}` }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: `Notification error: ${e.message}` }] };
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
