/* global React, Icon, PROJECTS, Chip, PrioChip, RoleChip, StatusChip, KBD, Btn, ROLE_META */
// hooks accessed via React.* to avoid global collisions across babel scripts

// ─────────────────────────────────────────────
// Mock board + agents
// ─────────────────────────────────────────────
const AGENTS = [
  { role: 'PO',  status: 'thinking', task: 'Refining acceptance for AT-218', tokens: '12.4k', model: 'claude-sonnet-4.5',
    transcript: [
      { kind: 'sys',  text: '─── tmux: ai-teams:0.0 ─ PO ─ active ───' },
      { kind: 'cmd',  text: '$ cat docs/board/AT-218.md' },
      { kind: 'out',  text: '## AT-218: Drag handle on column header' },
      { kind: 'out',  text: 'priority: P1  points: 3  assignee: FE' },
      { kind: 'ai',   text: '◆ I see the card lacks acceptance criteria. Adding three criteria now…' },
      { kind: 'cmd',  text: '$ aiteam edit AT-218 --add-acceptance' },
      { kind: 'out',  text: '✓ acceptance.1: Column reorders on drag from header' },
      { kind: 'out',  text: '✓ acceptance.2: Drop target shows insertion line' },
      { kind: 'out',  text: '✓ acceptance.3: Order persists across reload' },
      { kind: 'ai',   text: '◆ Done. Ready for TL review.' },
    ] },
  { role: 'TL',  status: 'live', task: 'Reviewing AT-201 PR diff', tokens: '8.1k', model: 'claude-sonnet-4.5',
    transcript: [
      { kind: 'sys',  text: '─── tmux: ai-teams:0.1 ─ TL ─ active ───' },
      { kind: 'cmd',  text: '$ git diff main..feature/at-201 --stat' },
      { kind: 'out',  text: ' frontend/components/board/TaskCard.tsx | 38 +++++++--' },
      { kind: 'out',  text: ' frontend/lib/dnd.ts                    | 12 +++' },
      { kind: 'out',  text: ' 2 files changed, 47 insertions(+), 3 deletions(-)' },
      { kind: 'ai',   text: '◆ Looks clean. One concern: React.useMemo deps in TaskCard line 64.' },
      { kind: 'ai',   text: '  Suggesting refactor — should I open a comment?' },
    ] },
  { role: 'BE',  status: 'live', task: 'Implementing /sprints/:id/burndown', tokens: '24.7k', model: 'claude-sonnet-4.5',
    transcript: [
      { kind: 'sys',  text: '─── tmux: ai-teams:0.2 ─ BE ─ active ───' },
      { kind: 'cmd',  text: '$ npm run test -- burndown' },
      { kind: 'out',  text: 'PASS  test/sprints.spec.ts' },
      { kind: 'out',  text: '  burndown' },
      { kind: 'out',  text: '    ✓ aggregates points per day (24ms)' },
      { kind: 'out',  text: '    ✓ excludes weekends (8ms)' },
      { kind: 'out',  text: '    ✓ handles empty sprint (3ms)' },
      { kind: 'out',  text: 'Tests: 3 passed, 3 total' },
      { kind: 'ai',   text: '◆ All tests green. Pushing commit.' },
      { kind: 'cmd',  text: '$ git commit -am "feat(api): burndown endpoint"' },
      { kind: 'out',  text: '[feature/at-220 a1b2c3d] feat(api): burndown endpoint' },
    ] },
  { role: 'FE',  status: 'thinking', task: 'AT-218: drag handle interaction', tokens: '18.3k', model: 'claude-sonnet-4.5',
    transcript: [
      { kind: 'sys',  text: '─── tmux: ai-teams:0.3 ─ FE ─ active ───' },
      { kind: 'cmd',  text: '$ npm run dev' },
      { kind: 'out',  text: '> next dev -p 3340' },
      { kind: 'out',  text: '✓ Ready in 2.1s' },
      { kind: 'ai',   text: '◆ Wiring up @dnd-kit useSortable on BoardColumn header…' },
      { kind: 'ai',   text: '◆ Need to decide: reorder columns OR cards within column?' },
      { kind: 'ai',   text: '  Asking PO for clarification.' },
    ] },
  { role: 'QA',  status: 'idle', task: 'Awaiting AT-201 build', tokens: '4.2k', model: 'claude-sonnet-4.5',
    transcript: [
      { kind: 'sys',  text: '─── tmux: ai-teams:0.4 ─ QA ─ idle ───' },
      { kind: 'out',  text: '◇ waiting for build artifact…' },
    ] },
];

const SPRINT = {
  number: 14,
  goal: 'Ship board polish: drag, hotkeys, burndown',
  status: 'active',
  started: '5 days ago',
  ends: 'in 2 days',
  points_total: 42,
  points_done: 21,
};

const BOARD = {
  todo: [
    { id: 'AT-218', title: 'Drag handle on column header', prio: 'P1', pts: 3, role: 'FE' },
    { id: 'AT-219', title: 'Hotkey: J/K to navigate cards', prio: 'P2', pts: 2, role: 'FE' },
    { id: 'AT-220', title: 'Burndown chart endpoint', prio: 'P1', pts: 5, role: 'BE', running: true },
    { id: 'AT-221', title: 'Empty-state illustration for /files', prio: 'P3', pts: 1, role: 'FE' },
  ],
  in_progress: [
    { id: 'AT-201', title: 'Sprint completion modal w/ retro prompt', prio: 'P0', pts: 5, role: 'FE', running: true },
    { id: 'AT-215', title: 'WS reconnect with exponential backoff', prio: 'P1', pts: 3, role: 'BE' },
    { id: 'AT-217', title: 'Acceptance refinement: AT-218', prio: 'P1', pts: 1, role: 'PO', running: true },
  ],
  in_review: [
    { id: 'AT-198', title: 'Move card by drag to other column', prio: 'P0', pts: 5, role: 'FE' },
    { id: 'AT-209', title: 'Server-sent events for board changes', prio: 'P1', pts: 3, role: 'BE' },
  ],
  testing: [
    { id: 'AT-189', title: 'Pin/unpin project card', prio: 'P2', pts: 2, role: 'QA' },
  ],
  done: [
    { id: 'AT-185', title: 'Project list query optimization', prio: 'P1', pts: 3, role: 'BE' },
    { id: 'AT-186', title: 'tmux pane title format spec', prio: 'P2', pts: 2, role: 'TL' },
    { id: 'AT-190', title: 'Login: forgot-password copy', prio: 'P3', pts: 1, role: 'PO' },
  ],
};

const COLUMNS = [
  { key: 'todo',         label: 'Todo',        accent: 'var(--fg-3)' },
  { key: 'in_progress',  label: 'In Progress', accent: 'var(--accent)' },
  { key: 'in_review',    label: 'In Review',   accent: 'var(--p2)' },
  { key: 'testing',      label: 'Testing',     accent: 'var(--p1)' },
  { key: 'done',         label: 'Done',        accent: 'var(--status-ok)' },
];

// ─────────────────────────────────────────────
// /project
// ─────────────────────────────────────────────
function ProjectPage({ project, tweaks }) {
  const [activeAgent, setActiveAgent] = React.useState(2); // BE
  const [layout, setLayout] = React.useState('terminals'); // terminals | board | split
  const [selected, setSelected] = React.useState('AT-201');
  const [terminalsOpen, setTerminalsOpen] = React.useState(true);
  const [rightTab, setRightTab] = React.useState('board'); // board | sprint | backlog | task

  const personality = tweaks?.personality !== false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Project subnav */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="layers" size={14} style={{ color: 'var(--fg-2)' }} />
          <b style={{ fontSize: 13, fontWeight: 500 }}>{project.name}</b>
          <Chip kind="status-live"><span className="chip-dot dot-pulse" style={{background:'currentColor'}}/>tmux</Chip>
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            session: {project.slug} · 5 panes
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <Btn icon="branch" size="sm" kind="ghost">main</Btn>
          <Btn icon="folderOpen" size="sm" kind="ghost">Files</Btn>
          <Btn icon="git" size="sm" kind="ghost">3 changes</Btn>
          <span style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 4px' }}/>
          <Btn size="sm" kind="ghost" icon="panel" title="Terminals left" onClick={() => setLayout('terminals')} />
          <Btn size="sm" kind="ghost" icon="panelRight" title="Board left" onClick={() => setLayout('board')} />
          <Btn size="sm" kind="ghost" icon="flip" title="Focus mode" onClick={() => setLayout(layout === 'terminals' ? 'board' : 'terminals')} />
        </div>
      </div>

      {/* Body — terminals / board */}
      <div style={{
        flex: 1, minHeight: 0, display: 'grid',
        gridTemplateColumns: layout === 'terminals' ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1.4fr)',
        gap: 1, background: 'var(--line)',
      }}>
        {layout === 'terminals' ? (
          <>
            <TerminalPanel agents={AGENTS} active={activeAgent} setActive={setActiveAgent} personality={personality} />
            <RightPanel tab={rightTab} setTab={setRightTab} selected={selected} setSelected={setSelected} project={project} />
          </>
        ) : (
          <>
            <RightPanel tab={rightTab} setTab={setRightTab} selected={selected} setSelected={setSelected} project={project} />
            <TerminalPanel agents={AGENTS} active={activeAgent} setActive={setActiveAgent} personality={personality} />
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Terminal panel: agent tabs + xterm-like view
// ─────────────────────────────────────────────
function TerminalPanel({ agents, active, setActive, personality }) {
  const ag = agents[active];
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active]);

  return (
    <section style={{ background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Agent rail */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        borderBottom: '1px solid var(--line)', flexShrink: 0,
      }}>
        {agents.map((a, i) => {
          const meta = ROLE_META[a.role];
          const isActive = i === active;
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                flex: '1 1 0', minWidth: 0,
                background: isActive ? 'var(--bg-0)' : 'transparent',
                border: 0,
                borderRight: i < agents.length - 1 ? '1px solid var(--line)' : 'none',
                borderBottom: isActive ? '1px solid var(--bg-0)' : '1px solid var(--line)',
                marginBottom: -1,
                padding: '8px 10px',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                textAlign: 'left',
                position: 'relative',
                color: isActive ? 'var(--fg-0)' : 'var(--fg-1)',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                <span className="chip-dot" style={{
                  width: 7, height: 7,
                  background: a.status === 'live' || a.status === 'thinking' ? 'var(--status-ok)' :
                              a.status === 'blocked' ? 'var(--status-err)' : 'var(--fg-mute)',
                }} />
                <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{meta.label}</span>
                {personality && <span style={{ fontSize: 11, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{meta.name}</span>}
                <span className="mono" style={{ fontSize: 9, color: 'var(--fg-3)', marginLeft: 'auto' }}>0.{i}</span>
              </div>
              {personality && (
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                  {a.status === 'thinking' ? '◆ ' : a.status === 'live' ? '▶ ' : '◇ '}{a.task}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Active terminal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-0)' }}>
        <div style={{
          padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: '1px solid var(--line-soft)', flexShrink: 0,
        }}>
          <RoleChip role={ag.role} status={ag.status} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>
            {ag.task}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{ag.model}</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{ag.tokens} ctx</span>
            <Btn size="sm" kind="ghost" icon="refresh" title="Restart" />
            <Btn size="sm" kind="ghost" icon="expand" title="Expand" />
          </span>
        </div>

        {/* xterm-like log */}
        <div ref={scrollRef} className="mono" style={{
          flex: 1, overflowY: 'auto', minHeight: 0,
          padding: '12px 14px',
          fontSize: 12, lineHeight: 1.55,
          color: 'var(--fg-1)',
        }}>
          {ag.transcript.map((line, i) => (
            <div key={i} style={{
              color: line.kind === 'sys' ? 'var(--fg-3)' :
                     line.kind === 'cmd' ? 'var(--fg-0)' :
                     line.kind === 'ai'  ? 'var(--accent)' :
                                            'var(--fg-1)',
              whiteSpace: 'pre-wrap',
              marginBottom: line.kind === 'ai' ? 2 : 0,
            }}>
              {line.text}
            </div>
          ))}
          {(ag.status === 'thinking' || ag.status === 'live') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', marginTop: 4 }}>
              <span>◆</span>
              <span style={{ color: 'var(--fg-2)' }}>thinking</span>
              <span className="term-cursor" style={{ width: 8, height: 14, background: 'var(--accent)', display: 'inline-block' }} />
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{
          borderTop: '1px solid var(--line-soft)',
          padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-1)',
          flexShrink: 0,
        }}>
          <span className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>❯</span>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Send to ${ROLE_META[ag.role].label}…`}
            className="mono"
            style={{
              flex: 1, border: 0, background: 'transparent', outline: 'none',
              color: 'var(--fg-0)', fontSize: 12,
            }}
          />
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>↵ send</span>
          <KBD>⌘↵</KBD>
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>broadcast</span>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Right panel — board / sprint / backlog / task
// ─────────────────────────────────────────────
function RightPanel({ tab, setTab, selected, setSelected, project }) {
  return (
    <section style={{ background: 'var(--bg-0)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', flexShrink: 0,
      }}>
        {[
          ['board', 'Board', 'layers'],
          ['sprint', 'Sprint', 'zap'],
          ['backlog', 'Backlog', 'list'],
          ['task', 'Detail', 'file'],
        ].map(([k, l, ic]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            border: 0, background: 'transparent',
            padding: '10px 14px',
            color: tab === k ? 'var(--fg-0)' : 'var(--fg-2)',
            borderBottom: tab === k ? '1px solid var(--fg-0)' : '1px solid transparent',
            marginBottom: -1,
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, cursor: 'pointer', fontWeight: 500,
          }}>
            <Icon name={ic} size={12} /> {l}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', padding: '6px 12px', display: 'flex', gap: 6 }}>
          <Btn size="sm" kind="ghost" icon="filter" title="Filter" />
          <Btn size="sm" kind="ghost" icon="search" title="Search" />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'board' && <BoardView selected={selected} onSelect={setSelected} />}
        {tab === 'sprint' && <SprintView />}
        {tab === 'backlog' && <BacklogView selected={selected} onSelect={setSelected} />}
        {tab === 'task' && <TaskDetail id={selected} onBack={() => setTab('board')} />}
      </div>
    </section>
  );
}

function BoardView({ selected, onSelect }) {
  return (
    <>
      <div style={{
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--line-soft)', flexShrink: 0,
      }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>
          Sprint <b style={{ color: 'var(--fg-0)' }}>#{SPRINT.number}</b> · {SPRINT.points_done}/{SPRINT.points_total} pts
        </span>
        <div style={{ flex: 1, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: (SPRINT.points_done/SPRINT.points_total*100)+'%', height: '100%', background: 'var(--accent)' }} />
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{SPRINT.ends}</span>
      </div>

      <div style={{
        flex: 1, overflowX: 'auto', overflowY: 'hidden', minHeight: 0,
        display: 'grid', gridTemplateColumns: 'repeat(5, minmax(220px, 1fr))', gap: 1, background: 'var(--line)',
      }}>
        {COLUMNS.map(col => (
          <div key={col.key} style={{ background: 'var(--bg-0)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{
              padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: '1px solid var(--line-soft)',
              background: 'var(--bg-1)',
              flexShrink: 0,
            }}>
              <span className="chip-dot" style={{ width: 8, height: 8, background: col.accent }} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{col.label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{(BOARD[col.key] || []).length}</span>
              <Btn size="sm" kind="ghost" icon="plus" style={{ marginLeft: 'auto' }} title="Add" />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(BOARD[col.key] || []).map(t => (
                <TaskCard key={t.id} task={t} selected={selected === t.id} onClick={() => onSelect(t.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TaskCard({ task, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left',
      background: selected ? 'var(--bg-3)' : 'var(--bg-1)',
      border: '1px solid ' + (selected ? 'var(--accent-line)' : 'var(--line-soft)'),
      borderRadius: 6,
      padding: 'var(--d-card-pad)',
      cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 8,
      transition: 'background 0.1s, border-color 0.1s',
    }}
    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-2)'; }}
    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-1)'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{task.id}</span>
        {task.running && (
          <span className="chip mono chip-status-thinking" style={{ marginLeft: 'auto', height: 16, fontSize: 9, padding: '0 5px' }}>
            <span className="chip-dot dot-pulse" style={{ background: 'currentColor', width: 5, height: 5 }} />
            agent
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--fg-0)', textWrap: 'pretty' }}>
        {task.title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PrioChip p={task.prio} />
        <RoleChip role={task.role} />
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-3)' }}>{task.pts}pt</span>
      </div>
    </button>
  );
}

function SprintView() {
  return (
    <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>SPRINT #{SPRINT.number}</span>
        <StatusChip status="live" label="active" />
      </div>
      <h2 className="h2" style={{ marginBottom: 8, textWrap: 'pretty' }}>{SPRINT.goal}</h2>
      <div className="mono" style={{ fontSize: 11, color: 'var(--fg-2)', marginBottom: 18 }}>
        Started {SPRINT.started} · Ends {SPRINT.ends}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 22 }}>
        {[
          ['Total', SPRINT.points_total + 'pt', 'var(--fg-0)'],
          ['Done', SPRINT.points_done + 'pt', 'var(--status-ok)'],
          ['In flight', '8pt', 'var(--accent)'],
          ['Blocked', '0pt', 'var(--fg-2)'],
        ].map(([l, v, c]) => (
          <div key={l} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 500, color: c, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Burndown sketch */}
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Burndown</span>
          <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-3)' }}>5d / 7d</span>
        </div>
        <Burndown />
        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 10 }}>
          <span className="mono" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--fg-2)' }}>
            <span style={{ width: 12, height: 1, background: 'var(--fg-3)' }} /> ideal
          </span>
          <span className="mono" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--fg-2)' }}>
            <span style={{ width: 12, height: 2, background: 'var(--accent)' }} /> actual
          </span>
        </div>
      </div>
    </div>
  );
}

function Burndown() {
  // Hand-laid points
  const ideal = [42, 36, 30, 24, 18, 12, 6, 0];
  const actual = [42, 39, 35, 28, 24, 21, null, null];
  const max = 42, w = 480, h = 120, padL = 28, padB = 18, padT = 6;
  const xs = i => padL + i * (w - padL - 8) / (ideal.length - 1);
  const ys = v => padT + (1 - v / max) * (h - padT - padB);
  const idealPath = ideal.map((v, i) => (i ? 'L' : 'M') + xs(i) + ' ' + ys(v)).join(' ');
  const actualPts = actual.map((v, i) => v == null ? null : [xs(i), ys(v)]).filter(Boolean);
  const actualPath = actualPts.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <line key={i} x1={padL} x2={w-8} y1={padT + f * (h - padT - padB)} y2={padT + f * (h - padT - padB)}
              stroke="var(--line-soft)" strokeDasharray="2 3" />
      ))}
      <text x={4} y={ys(max)+4} fill="var(--fg-3)" fontSize="9" fontFamily="var(--font-mono)">42pt</text>
      <text x={4} y={ys(0)+4} fill="var(--fg-3)" fontSize="9" fontFamily="var(--font-mono)">0</text>
      <path d={idealPath} fill="none" stroke="var(--fg-3)" strokeWidth="1" strokeDasharray="3 3"/>
      <path d={actualPath} fill="none" stroke="var(--accent)" strokeWidth="2"/>
      {actualPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="var(--bg-0)" stroke="var(--accent)" strokeWidth="1.5"/>
      ))}
    </svg>
  );
}

function BacklogView({ selected, onSelect }) {
  const groups = [
    ['P0', [{ id: 'AT-230', title: 'Multi-project dashboard live status', pts: 8 }]],
    ['P1', [
      { id: 'AT-228', title: 'Agent cost dashboard', pts: 5 },
      { id: 'AT-231', title: 'Markdown WYSIWYG for task body', pts: 8 },
    ]],
    ['P2', [
      { id: 'AT-225', title: 'Terminal copy-on-select', pts: 1 },
      { id: 'AT-226', title: 'Sprint retro template', pts: 3 },
      { id: 'AT-232', title: 'Slack notifications on sprint complete', pts: 3 },
    ]],
    ['P3', [
      { id: 'AT-227', title: 'Theme: high contrast', pts: 2 },
      { id: 'AT-233', title: 'Easter egg: ASCII boss greeting', pts: 1 },
    ]],
  ];
  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {groups.map(([prio, items]) => (
        <div key={prio}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            background: 'var(--bg-1)',
            borderBottom: '1px solid var(--line-soft)',
            position: 'sticky', top: 0, zIndex: 1,
          }}>
            <PrioChip p={prio} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{items.length} items</span>
            <Btn size="sm" kind="ghost" icon="plus" style={{ marginLeft: 'auto' }}>Add</Btn>
          </div>
          {items.map(it => (
            <div key={it.id} onClick={() => onSelect(it.id)}
                 style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderBottom: '1px solid var(--line-soft)',
                    cursor: 'pointer',
                    background: selected === it.id ? 'var(--bg-2)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (selected !== it.id) e.currentTarget.style.background = 'var(--bg-2)'; }}
                  onMouseLeave={e => { if (selected !== it.id) e.currentTarget.style.background = 'transparent'; }}>
              <Icon name="dot" size={6} style={{ color: 'var(--fg-3)' }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', width: 56 }}>{it.id}</span>
              <span style={{ fontSize: 13, flex: 1, textWrap: 'pretty' }}>{it.title}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{it.pts}pt</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TaskDetail({ id, onBack }) {
  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Btn size="sm" kind="ghost" icon="arrowLeft" onClick={onBack}>Board</Btn>
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 'auto' }}>~/projects/ai-teams/docs/board/AT-201.md</span>
        <Btn size="sm" kind="ghost" icon="copy" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{id}</span>
        <PrioChip p="P0" />
        <RoleChip role="FE" status="thinking" showName />
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-2)' }}>5pt · in_progress</span>
      </div>
      <h1 className="h1" style={{ fontSize: 22, fontWeight: 500, marginBottom: 16, textWrap: 'pretty' }}>
        Sprint completion modal w/ retro prompt
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 24 }}>
        <div>
          <Section label="Description">
            <p>When a sprint is completed, present the boss with a modal summarizing velocity, completion %, and a free-text retro field. The retro is appended to the sprint's Markdown file.</p>
          </Section>
          <Section label="Acceptance">
            <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
              <li>Modal opens on "Complete sprint" click and on hotkey ⌘⇧K.</li>
              <li>Shows points done / total, and a delta vs previous sprint.</li>
              <li>Retro text saves to <span className="mono" style={{ background: 'var(--bg-3)', padding: '0 4px', borderRadius: 3 }}>sprints/14/retro.md</span>.</li>
              <li>Closing without saving prompts confirm.</li>
            </ul>
          </Section>
          <Section label="Activity">
            <Activity />
          </Section>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SidebarField label="Sprint" value="#14 — Board polish" />
          <SidebarField label="Assignee" value={<RoleChip role="FE" status="thinking" />} />
          <SidebarField label="Priority" value={<PrioChip p="P0" />} />
          <SidebarField label="Points" value="5" />
          <SidebarField label="Status" value="in_progress" />
          <SidebarField label="Created" value="2 days ago" />
          <SidebarField label="Updated" value="4 min ago" />
        </div>
      </div>
    </div>
  );
}

const Section = ({ label, children }) => (
  <div style={{ marginBottom: 20 }}>
    <div className="mono" style={{
      fontSize: 10, color: 'var(--fg-3)',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      marginBottom: 6,
    }}>{label}</div>
    <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.6 }}>{children}</div>
  </div>
);
const SidebarField = ({ label, value }) => (
  <div>
    <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 12 }}>{value}</div>
  </div>
);

function Activity() {
  const items = [
    { who: 'FE', text: 'Pushed commit a1b2c3d', time: '4m', kind: 'git' },
    { who: 'TL', text: 'Approved acceptance criteria', time: '1h', kind: 'check' },
    { who: 'PO', text: 'Refined description', time: '5h', kind: 'edit' },
    { who: 'Hung', text: 'Created task', time: '2d', kind: 'create' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 4 }}>
      {items.map((a, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < items.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
          {a.who === 'Hung' ?
            <div className="sb-avatar" style={{ width: 18, height: 18, fontSize: 9 }}>H</div> :
            <RoleChip role={a.who} />
          }
          <span style={{ fontSize: 12 }}>{a.text}</span>
          <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-3)' }}>{a.time}</span>
        </div>
      ))}
    </div>
  );
}

window.ProjectPage = ProjectPage;
