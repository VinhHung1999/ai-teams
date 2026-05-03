/* global React, Icon, PROJECTS, Chip, PrioChip, RoleChip, StatusChip, KBD, Btn, ROLE_META */
// hooks accessed via React.* to avoid global collisions

// ─────────────────────────────────────────────
// /files
// ─────────────────────────────────────────────
const FILE_TREE = [
  { name: 'frontend', kind: 'folder', children: [
    { name: 'app', kind: 'folder', children: [
      { name: 'page.tsx', kind: 'file', mod: 'M' },
      { name: 'project', kind: 'folder', children: [
        { name: 'page.tsx', kind: 'file', mod: 'M', active: true },
      ]},
      { name: 'assistant', kind: 'folder' },
      { name: 'files', kind: 'folder' },
      { name: 'login', kind: 'folder' },
    ]},
    { name: 'components', kind: 'folder', children: [
      { name: 'board', kind: 'folder', children: [
        { name: 'KanbanBoard.tsx', kind: 'file', mod: 'M' },
        { name: 'BoardColumn.tsx', kind: 'file' },
        { name: 'TaskCard.tsx', kind: 'file', mod: 'A' },
        { name: 'TaskDetail.tsx', kind: 'file' },
      ]},
      { name: 'AgentPaneView.tsx', kind: 'file' },
      { name: 'WebTerminal.tsx', kind: 'file' },
    ]},
    { name: 'lib', kind: 'folder', children: [
      { name: 'api.ts', kind: 'file' },
      { name: 'types.ts', kind: 'file' },
      { name: 'useBoardWs.ts', kind: 'file' },
    ]},
    { name: 'package.json', kind: 'file' },
    { name: 'tailwind.config.ts', kind: 'file' },
  ]},
  { name: 'backend-node', kind: 'folder' },
  { name: 'docs', kind: 'folder', children: [
    { name: 'ui-revamp', kind: 'folder', children: [
      { name: 'BRIEF.md', kind: 'file' },
    ]},
  ]},
  { name: 'README.md', kind: 'file' },
];

const FILE_CONTENT = `import { useEffect, useState } from "react";
import { api, type BoardItem, type Board } from "@/lib/api";
import { useBoardWs } from "@/lib/useBoardWs";
import { KanbanBoard } from "@/components/board/KanbanBoard";
import { AgentPaneView } from "@/components/AgentPaneView";

export default function ProjectPage({
  searchParams,
}: { searchParams: { id: string } }) {
  const projectId = Number(searchParams.id);
  const [board, setBoard] = useState<Board | null>(null);

  React.useEffect(() => {
    api.getDashboard(projectId).then((d) => setBoard(d.boards[0] ?? null));
  }, [projectId]);

  useBoardWs(projectId, (msg) => {
    if (msg.type === "board.update") {
      setBoard(msg.board);
    }
  });

  return (
    <div className="grid grid-cols-2 h-screen">
      <AgentPaneView projectId={projectId} />
      <KanbanBoard board={board} onMove={api.moveItem} />
    </div>
  );
}`;

const GIT_CHANGES = [
  { path: 'frontend/app/project/page.tsx', mod: 'M', plus: 24, minus: 6 },
  { path: 'frontend/components/board/TaskCard.tsx', mod: 'M', plus: 38, minus: 3 },
  { path: 'frontend/components/board/KanbanBoard.tsx', mod: 'M', plus: 12, minus: 4 },
  { path: 'frontend/lib/dnd.ts', mod: 'A', plus: 47, minus: 0 },
];

function FilesPage({ project }) {
  const [tab, setTab] = React.useState('source'); // source | changes
  const [active, setActive] = React.useState('frontend/app/project/page.tsx');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: '100%', minHeight: 0 }}>
      <aside style={{ background: 'var(--bg-1)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{
          padding: '8px 10px', borderBottom: '1px solid var(--line-soft)',
          display: 'flex', gap: 0,
        }}>
          {[['source', 'Source', 'folderOpen'], ['changes', 'Changes', 'diff']].map(([k, l, ic]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, border: 0, background: tab === k ? 'var(--bg-3)' : 'transparent',
              color: tab === k ? 'var(--fg-0)' : 'var(--fg-1)',
              padding: '6px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Icon name={ic} size={12} /> {l}
              {k === 'changes' && (
                <span className="mono" style={{ fontSize: 10, color: 'var(--accent)' }}>{GIT_CHANGES.length}</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '6px 4px' }}>
          {tab === 'source' ? (
            <Tree nodes={FILE_TREE} depth={0} active={active} onSelect={setActive} />
          ) : (
            <div style={{ padding: 4 }}>
              {GIT_CHANGES.map(c => (
                <button key={c.path} onClick={() => setActive(c.path)} className="sb-item"
                  style={{
                    background: active === c.path ? 'var(--bg-3)' : 'transparent',
                    fontSize: 11, padding: '4px 6px',
                  }}>
                  <span className="mono" style={{
                    width: 14, fontSize: 10,
                    color: c.mod === 'A' ? 'var(--status-ok)' : c.mod === 'M' ? 'var(--p1)' : 'var(--status-err)',
                  }}>{c.mod}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl' }}>
                    <span style={{ direction: 'ltr', unicodeBidi: 'plaintext' }} className="mono">{c.path}</span>
                  </span>
                  <span className="mono" style={{ fontSize: 9, color: 'var(--status-ok)' }}>+{c.plus}</span>
                  <span className="mono" style={{ fontSize: 9, color: 'var(--status-err)' }}>-{c.minus}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="branch" size={12} style={{ color: 'var(--fg-2)' }} />
          <span className="mono" style={{ fontSize: 11 }}>main</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginLeft: 'auto' }}>↑2 ↓0</span>
        </div>
      </aside>

      <main style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-0)' }}>
        <div style={{
          padding: '8px 14px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <Icon name="fileCode" size={13} style={{ color: 'var(--fg-2)' }} />
          <span className="mono" style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--fg-3)' }}>~/projects/{project?.slug || 'ai-teams'}/</span>
            <span style={{ color: 'var(--fg-0)' }}>{active}</span>
          </span>
          {tab === 'changes' && (
            <span className="chip mono chip-prio-P1" style={{ marginLeft: 4 }}>modified</span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Btn size="sm" kind="ghost" icon="copy" title="Copy" />
            <Btn size="sm" kind="ghost" icon="eye" title="Open">Open</Btn>
          </div>
        </div>

        {tab === 'source' ? (
          <CodeView code={FILE_CONTENT} />
        ) : (
          <DiffView />
        )}
      </main>
    </div>
  );
}

function Tree({ nodes, depth, active, onSelect }) {
  return (
    <div>
      {nodes.map(n => <TreeNode key={n.name} node={n} depth={depth} active={active} onSelect={onSelect} />)}
    </div>
  );
}
function TreeNode({ node, depth, active, onSelect, parentPath = '' }) {
  const path = parentPath ? parentPath + '/' + node.name : node.name;
  const [open, setOpen] = React.useState(node.children && depth < 2);
  const isActive = active === path;
  return (
    <>
      <button
        className="sb-item"
        onClick={() => node.children ? setOpen(!open) : onSelect(path)}
        style={{
          padding: '3px 6px',
          fontSize: 12,
          background: isActive ? 'var(--bg-3)' : 'transparent',
          color: isActive ? 'var(--fg-0)' : 'var(--fg-1)',
        }}
      >
        <span style={{ width: depth * 10 }} />
        <Icon name={node.children ? (open ? 'chevDown' : 'chevRight') : 'dot'} size={11} style={{ color: 'var(--fg-3)' }} />
        <Icon name={node.children ? (open ? 'folderOpen' : 'folder') : 'file'} size={12} style={{
          color: node.children ? 'var(--fg-2)' : 'var(--fg-3)',
        }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="mono">
          {node.name}
        </span>
        {node.mod && (
          <span className="mono" style={{
            fontSize: 9, color: node.mod === 'A' ? 'var(--status-ok)' : 'var(--p1)',
          }}>{node.mod}</span>
        )}
      </button>
      {open && node.children && (
        <div>
          {node.children.map(c => <TreeNode key={c.name} node={c} depth={depth+1} active={active} onSelect={onSelect} parentPath={path} />)}
        </div>
      )}
    </>
  );
}

function CodeView({ code }) {
  const lines = code.split('\n');
  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 0 }}>
      <pre className="mono" style={{
        margin: 0, padding: '14px 0',
        fontSize: 12.5, lineHeight: 1.65,
        color: 'var(--fg-0)',
      }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', paddingLeft: 14, paddingRight: 14 }}>
            <span style={{ width: 36, color: 'var(--fg-mute)', textAlign: 'right', paddingRight: 14, userSelect: 'none' }}>{i+1}</span>
            <span style={{ flex: 1, whiteSpace: 'pre' }}>{highlight(l)}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

// Tiny TS/JSX highlight
function highlight(line) {
  const tokens = [];
  const KEYWORDS = ['import', 'from', 'export', 'default', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'useEffect', 'useState', 'type', 'interface'];
  const STRING_RE = /"[^"]*"|'[^']*'|`[^`]*`/;
  const COMMENT_RE = /\/\/.*/;
  let rest = line;
  let key = 0;
  while (rest.length) {
    const c = COMMENT_RE.exec(rest);
    if (c && c.index === 0) { tokens.push(<span key={key++} style={{color:'var(--fg-3)'}}>{c[0]}</span>); rest = rest.slice(c[0].length); continue; }
    const s = STRING_RE.exec(rest);
    if (s && s.index === 0) { tokens.push(<span key={key++} style={{color:'var(--status-ok)'}}>{s[0]}</span>); rest = rest.slice(s[0].length); continue; }
    const w = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (w) {
      const word = w[0];
      const color = KEYWORDS.includes(word) ? 'var(--accent)' :
                    /^[A-Z]/.test(word) ? 'var(--p1)' :
                    'var(--fg-0)';
      tokens.push(<span key={key++} style={{color}}>{word}</span>);
      rest = rest.slice(word.length);
      continue;
    }
    const n = /^\d+/.exec(rest);
    if (n) { tokens.push(<span key={key++} style={{color:'var(--p2)'}}>{n[0]}</span>); rest = rest.slice(n[0].length); continue; }
    tokens.push(<span key={key++}>{rest[0]}</span>);
    rest = rest.slice(1);
  }
  return tokens;
}

function DiffView() {
  const lines = [
    { mod: ' ', text: 'export default function ProjectPage({' },
    { mod: ' ', text: '  searchParams,' },
    { mod: ' ', text: '}: { searchParams: { id: string } }) {' },
    { mod: ' ', text: '  const projectId = Number(searchParams.id);' },
    { mod: '-', text: '  const [board, setBoard] = useState<Board | null>(null);' },
    { mod: '+', text: '  const [board, setBoard] = useState<Board | null>(null);' },
    { mod: '+', text: '  const [selected, setSelected] = useState<string | null>(null);' },
    { mod: ' ', text: '' },
    { mod: ' ', text: '  React.useEffect(() => {' },
    { mod: '-', text: '    api.getDashboard(projectId).then((d) => setBoard(d.boards[0] ?? null));' },
    { mod: '+', text: '    const ctrl = new AbortController();' },
    { mod: '+', text: '    api.getDashboard(projectId, { signal: ctrl.signal })' },
    { mod: '+', text: '      .then((d) => setBoard(d.boards[0] ?? null));' },
    { mod: '+', text: '    return () => ctrl.abort();' },
    { mod: ' ', text: '  }, [projectId]);' },
  ];
  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <pre className="mono" style={{ margin: 0, padding: '14px 0', fontSize: 12.5, lineHeight: 1.65 }}>
        {lines.map((l, i) => (
          <div key={i} style={{
            display: 'flex',
            background: l.mod === '+' ? 'rgba(110,231,183,0.06)' :
                        l.mod === '-' ? 'rgba(248,113,113,0.06)' : 'transparent',
            paddingLeft: 14, paddingRight: 14,
          }}>
            <span style={{ width: 22, color: 'var(--fg-mute)', textAlign: 'right', paddingRight: 12, userSelect: 'none' }}>{i+1}</span>
            <span style={{
              width: 18, textAlign: 'center', userSelect: 'none',
              color: l.mod === '+' ? 'var(--status-ok)' : l.mod === '-' ? 'var(--status-err)' : 'var(--fg-mute)',
            }}>{l.mod === ' ' ? '' : l.mod}</span>
            <span style={{ flex: 1, whiteSpace: 'pre' }}>{highlight(l.text)}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

window.FilesPage = FilesPage;
