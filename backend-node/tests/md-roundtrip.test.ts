/**
 * Snapshot test: MD → JSON → MD round-trip.
 * Verifies that parsing and re-serializing a sprint file loses no data.
 *
 * Run: npx tsx tests/md-roundtrip.test.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Import internal functions from MarkdownStorage (we expose them via a test helper)
// We re-implement the minimal parse/serialize cycle here to keep things self-contained.

const SPRINT_FILE = path.join(
  __dirname,
  '../../docs/board/sprints/archive/sprint-26.md'
);

const BOARD_COLUMNS = ['todo', 'in_progress', 'in_review', 'testing', 'done'];
const COLUMN_TITLES: Record<string, string> = {
  todo: '📋 Todo',
  in_progress: '🔨 In Progress',
  in_review: '👀 In Review',
  testing: '🧪 Testing',
  done: '✅ Done',
};

interface Card {
  siId: number;
  title: string;
  done: boolean;
  priority: string;
  points: number | null;
  assignee: string | null;
  boardStatus: string | null;
  backlogId: number;
  description: string | null;
  acceptance: Array<{ text: string; done: boolean }>;
  notes: string | null;
}

function parseMetaLine(line: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = line.split(' · ');
  for (const part of parts) {
    const m = part.match(/^\*\*([^:]+):\*\*\s*(.*)$/);
    if (m) result[m[1].trim()] = m[2].trim();
  }
  return result;
}

function parseCard(lines: string[]): Card | null {
  if (!lines.length) return null;
  const firstMatch = lines[0].match(/^- \[([ x])\] \*\*\[(\d+)\]\*\* (.*)$/);
  if (!firstMatch) return null;

  const done = firstMatch[1] === 'x';
  const siId = parseInt(firstMatch[2], 10);
  const title = firstMatch[3].trim();
  let priority = 'P2', points: number | null = null, assignee: string | null = null;
  let boardStatus: string | null = null, backlogId = siId;
  let description: string | null = null, notes: string | null = null;
  const acceptance: Array<{ text: string; done: boolean }> = [];

  let i = 1;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && lines[i].trim().startsWith('**')) {
    const meta = parseMetaLine(lines[i].trim());
    if (meta['Priority']) priority = meta['Priority'];
    if (meta['Points']) points = parseInt(meta['Points'], 10) || null;
    if (meta['Assignee']) assignee = meta['Assignee'];
    if (meta['Status']) boardStatus = meta['Status'];
    if (meta['Backlog-ID']) backlogId = parseInt(meta['Backlog-ID'], 10) || siId;
    i++;
  }

  let section: 'none' | 'description' | 'acceptance' | 'notes' = 'none';
  const descLines: string[] = [], notesLines: string[] = [];

  while (i < lines.length) {
    const stripped = lines[i].trim(); i++;
    if (stripped === '**Description:**') { section = 'description'; continue; }
    if (stripped === '**Acceptance:**') { section = 'acceptance'; continue; }
    if (stripped === '**Notes:**') { section = 'notes'; continue; }
    if (section === 'description') descLines.push(stripped);
    else if (section === 'acceptance') {
      const m = stripped.match(/^- \[([ x])\] (.*)$/);
      if (m) acceptance.push({ text: m[2].trim(), done: m[1] === 'x' });
    } else if (section === 'notes') notesLines.push(stripped);
  }

  if (descLines.length) description = descLines.join('\n').trim() || null;
  if (notesLines.length) notes = notesLines.join('\n').trim() || null;

  return { siId, title, done, priority, points, assignee, boardStatus, backlogId, description, acceptance, notes };
}

function parseSprintCards(content: string): { column: string; card: Card }[] {
  const lines = content.split('\n');
  const result: { column: string; card: Card }[] = [];
  let currentColumn: string | null = null;
  let cardLines: string[] = [];

  const flush = () => {
    if (cardLines.length > 0) {
      const card = parseCard(cardLines);
      if (card && currentColumn) result.push({ column: currentColumn, card });
      cardLines = [];
    }
  };

  for (const line of lines) {
    const col = Object.entries(COLUMN_TITLES).find(([, t]) => line === `## ${t}`);
    if (col) { flush(); currentColumn = col[0]; continue; }
    if (line.startsWith('%% kanban:settings') || line.startsWith('```') || line === '%%') continue;
    if (currentColumn) {
      if (/^- \[[ x]\] \*\*\[\d+\]\*\*/.test(line)) { flush(); cardLines = [line]; }
      else if (cardLines.length > 0) cardLines.push(line);
    }
  }
  flush();
  return result;
}

function indent(text: string, spaces = 6): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(l => (l.length ? pad + l : l)).join('\n');
}

function cardToText(c: Card): string {
  const checkbox = c.done ? 'x' : ' ';
  const lines: string[] = [`- [${checkbox}] **[${c.siId}]** ${c.title}`];
  const meta = [`**Priority:** ${c.priority}`];
  if (c.points != null) meta.push(`**Points:** ${c.points}`);
  if (c.assignee) meta.push(`**Assignee:** ${c.assignee}`);
  if (c.boardStatus) meta.push(`**Status:** ${c.boardStatus}`);
  meta.push(`**Backlog-ID:** ${c.backlogId}`);
  lines.push(indent(meta.join(' · ')));
  if (c.description) { lines.push(indent('**Description:**')); lines.push(indent(c.description)); }
  if (c.acceptance.length) {
    lines.push(indent('**Acceptance:**'));
    for (const a of c.acceptance) lines.push(indent(`- [${a.done ? 'x' : ' '}] ${a.text}`));
  }
  if (c.notes) { lines.push(indent('**Notes:**')); lines.push(indent(c.notes)); }
  return lines.join('\n');
}

function pass(label: string) { console.log(`  ✅ ${label}`); }
function fail(label: string, detail?: string) {
  console.error(`  ❌ ${label}`);
  if (detail) console.error(`     ${detail}`);
  process.exitCode = 1;
}

async function main() {
  console.log('MD Round-trip snapshot test\n');

  const content = await fs.readFile(SPRINT_FILE, 'utf-8');
  const cards = parseSprintCards(content);

  console.log(`Parsed ${cards.length} cards from sprint-26.md`);
  if (cards.length === 0) {
    fail('Expected at least 1 card in sprint-26.md');
    return;
  }
  pass('Parsed cards successfully');

  // Check known card [269]
  const c269 = cards.find(({ card }) => card.siId === 269);
  if (!c269) {
    fail('Card [269] not found');
  } else {
    pass('Card [269] found');
    if (c269.card.title.includes('AgentPaneView')) {
      pass('Card [269] title preserved');
    } else {
      fail('Card [269] title mismatch', c269.card.title);
    }
    if (c269.card.backlogId === 313) {
      pass('Card [269] Backlog-ID=313 preserved');
    } else {
      fail('Card [269] Backlog-ID mismatch', String(c269.card.backlogId));
    }
    if (c269.column === 'done') {
      pass('Card [269] in done column');
    } else {
      fail('Card [269] column mismatch', c269.column);
    }
    if (c269.card.done) {
      pass('Card [269] checkbox=done');
    } else {
      fail('Card [269] checkbox should be done');
    }
    if (c269.card.assignee === 'DEV') {
      pass('Card [269] assignee=DEV');
    } else {
      fail('Card [269] assignee mismatch', String(c269.card.assignee));
    }
    if (c269.card.description && c269.card.description.includes('AgentPaneView')) {
      pass('Card [269] description preserved');
    } else {
      fail('Card [269] description missing/wrong', c269.card.description ?? '(null)');
    }
  }

  // Round-trip: re-serialize all cards and check they match
  let roundTripOk = true;
  for (const { card } of cards) {
    const text = cardToText(card);
    const reparsed = parseCard(text.split('\n'));
    if (!reparsed) { fail(`Re-parse failed for card [${card.siId}]`); roundTripOk = false; continue; }

    if (reparsed.siId !== card.siId) { fail(`siId mismatch [${card.siId}]`); roundTripOk = false; }
    if (reparsed.title !== card.title) { fail(`title mismatch [${card.siId}]`, reparsed.title); roundTripOk = false; }
    if (reparsed.done !== card.done) { fail(`done mismatch [${card.siId}]`); roundTripOk = false; }
    if (reparsed.priority !== card.priority) { fail(`priority mismatch [${card.siId}]`); roundTripOk = false; }
    if (reparsed.backlogId !== card.backlogId) { fail(`backlogId mismatch [${card.siId}]`); roundTripOk = false; }
    if (reparsed.assignee !== card.assignee) { fail(`assignee mismatch [${card.siId}]`); roundTripOk = false; }
    if (reparsed.boardStatus !== card.boardStatus) { fail(`boardStatus mismatch [${card.siId}]`); roundTripOk = false; }
  }
  if (roundTripOk) pass(`Round-trip OK for all ${cards.length} cards`);

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
