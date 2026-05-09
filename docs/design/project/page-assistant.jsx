/* global React, Icon, PROJECTS, Chip, PrioChip, RoleChip, StatusChip, KBD, Btn, ROLE_META */
// hooks accessed via React.* to avoid global collisions

// ─────────────────────────────────────────────
// /assistant
// ─────────────────────────────────────────────
const CONVERSATIONS = [
  { id: 1, title: 'Sprint 14 priorities', last: 'now', active: true, project: 'ai-teams' },
  { id: 2, title: 'Reviewing AT-201 implementation', last: '2h', project: 'ai-teams' },
  { id: 3, title: 'Composer keyboard shortcuts', last: 'yesterday', project: 'composer' },
  { id: 4, title: 'How to structure MCP tools?', last: '3d', project: 'mcp-bridge' },
  { id: 5, title: 'Brainstorm: agent autonomy levels', last: '1w', project: 'ai-teams' },
];

const MESSAGES = [
  { who: 'me', text: 'Look at sprint 14 — does the load look right? FE seems heavy.' },
  { who: 'ai', text: "Let me check.", think: ['Reading sprints/14.md', 'Tallying points by role', 'Comparing to last sprint'] },
  { who: 'ai', text: "FE has 13pt across 4 cards (AT-198, 201, 218, 221). BE has 11pt across 3. PO has 1pt. That's roughly the same FE/BE split as sprint 13 (12 vs 10), so it's consistent — but yes, FE is the bottleneck.\n\nIf you want to rebalance: AT-218 (drag handle, 3pt) is the only one not started. I could move it to sprint 15 or have BE pair on it." },
  { who: 'me', text: 'Move AT-218 to sprint 15. And what about QA — only 1 card?' },
  { who: 'ai', text: "QA picks up cards as they hit `in_review`. Sprint 14 currently has 2 cards in review (AT-198, AT-209) and 1 in testing (AT-189). QA load follows from completion pace, not pre-assignment.\n\nWant me to move AT-218 now?", actions: ['Move AT-218 → Sprint 15', 'Show me other rebalances first'] },
];

function AssistantPage({ project }) {
  const [active, setActive] = React.useState(1);
  const [input, setInput] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: '100%', minHeight: 0 }}>
      {/* Conversations sidebar */}
      <aside style={{
        background: 'var(--bg-1)', borderRight: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line-soft)' }}>
          <Btn icon="plus" kind="primary" style={{ width: '100%', justifyContent: 'center' }}>New chat</Btn>
        </div>
        <div className="search" style={{ margin: '10px 12px', width: 'auto' }}>
          <Icon name="search" />
          <input placeholder="Search…" />
          <span className="kbd mono">⌘F</span>
        </div>
        <div style={{ padding: '0 6px 8px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div className="sb-section">Today</div>
          {CONVERSATIONS.filter(c => c.last === 'now' || c.last.includes('h') || c.last === 'yesterday').map(c => (
            <ConvItem key={c.id} c={c} active={active === c.id} onClick={() => setActive(c.id)} />
          ))}
          <div className="sb-section">Earlier</div>
          {CONVERSATIONS.filter(c => !(c.last === 'now' || c.last.includes('h') || c.last === 'yesterday')).map(c => (
            <ConvItem key={c.id} c={c} active={active === c.id} onClick={() => setActive(c.id)} />
          ))}
        </div>
      </aside>

      {/* Chat */}
      <main style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-0)' }}>
        <div style={{
          padding: '10px 18px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <Icon name="brain" size={14} style={{ color: 'var(--accent)' }} />
          <b style={{ fontSize: 13, fontWeight: 500 }}>Sprint 14 priorities</b>
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', padding: '1px 6px', border: '1px solid var(--line)', borderRadius: 4 }}>
            scope: ai-teams
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Btn size="sm" kind="ghost" icon="copy" title="Copy thread" />
            <Btn size="sm" kind="ghost" icon="more" />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '24px 0' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            {MESSAGES.map((m, i) => (
              <Message key={i} m={m} />
            ))}
          </div>
        </div>

        <div style={{
          padding: '12px 24px 16px',
          borderTop: '1px solid var(--line)',
          background: 'var(--bg-1)',
          flexShrink: 0,
        }}>
          <div style={{
            maxWidth: 760, margin: '0 auto',
            border: '1px solid var(--line)',
            background: 'var(--bg-2)',
            borderRadius: 10,
            padding: 10,
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask, command, or paste an image…"
              rows={2}
              style={{
                width: '100%',
                border: 0, outline: 0, background: 'transparent',
                resize: 'none',
                color: 'var(--fg-0)',
                fontSize: 13, fontFamily: 'inherit',
                minHeight: 36,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Btn size="sm" kind="ghost" icon="paperclip" title="Attach" />
              <Btn size="sm" kind="ghost" icon="image" title="Image" />
              <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>scope:</span>
              <button className="btn btn-sm btn-ghost mono">ai-teams</button>
              <div style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>claude-sonnet-4.5</span>
              <KBD>⌘↵</KBD>
              <Btn size="sm" kind="primary" icon="send">Send</Btn>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ConvItem({ c, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="sb-item"
      style={{
        background: active ? 'var(--bg-3)' : 'transparent',
        color: active ? 'var(--fg-0)' : 'var(--fg-1)',
        flexDirection: 'column', alignItems: 'flex-start', gap: 2,
        padding: '8px 8px',
      }}
    >
      <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 12, fontWeight: 500, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{c.title}</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{c.last}</span>
      </div>
      <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{c.project}</span>
    </button>
  );
}

function Message({ m }) {
  if (m.who === 'me') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          background: 'var(--bg-3)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          padding: '10px 14px',
          maxWidth: '80%',
          fontSize: 13, lineHeight: 1.55,
          textWrap: 'pretty',
        }}>
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
        background: 'var(--bg-2)', border: '1px solid var(--accent-line)',
        display: 'grid', placeItems: 'center', color: 'var(--accent)', marginTop: 2,
      }}>
        <Icon name="brain" size={13} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {m.think && (
          <div style={{
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 8,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ◆ thinking
            </div>
            {m.think.map((t, i) => (
              <div key={i} className="mono" style={{ fontSize: 11, color: 'var(--fg-2)', display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--status-ok)' }}>✓</span> {t}
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--fg-0)', whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>
          {m.text}
        </div>
        {m.actions && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {m.actions.map((a, i) => (
              <button key={i} className="btn btn-sm" style={{ fontSize: 11 }}>
                {i === 0 && <Icon name="zap" size={11} style={{ color: 'var(--accent)' }} />}
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

window.AssistantPage = AssistantPage;
