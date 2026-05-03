/* global React, Icon, PROJECTS, Chip, PrioChip, RoleChip, StatusChip, KBD, Btn, ROLE_META */
// hooks accessed via React.* to avoid global collisions

// ─────────────────────────────────────────────
// /  Dashboard
// ─────────────────────────────────────────────
function DashboardPage({ onOpen, onNavigate }) {
  const [filter, setFilter] = React.useState('all');
  const [view, setView] = React.useState('grid');
  const projects = PROJECTS;
  const filtered = filter === 'pinned' ? projects.filter(p => p.pinned) :
                   filter === 'live'   ? projects.filter(p => p.tmux_active) :
                                          projects;

  return (
    <div style={{ padding: '32px 40px 64px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 className="h1">Projects</h1>
          <div className="muted mono" style={{ fontSize: 12, marginTop: 6 }}>
            {projects.length} projects · {projects.filter(p => p.tmux_active).length} live tmux sessions
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Btn icon="plus" kind="primary">New project</Btn>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
        {[['all','All'],['pinned','Pinned'],['live','Live']].map(([k, l]) => (
          <button key={k}
            className={'btn ' + (filter === k ? '' : 'btn-ghost')}
            onClick={() => setFilter(k)}
            style={{ fontSize: 12 }}>
            {l}
            <span className="mono" style={{ color: 'var(--fg-3)', marginLeft: 4, fontSize: 11 }}>
              {k === 'all' ? projects.length : k === 'pinned' ? projects.filter(p => p.pinned).length : projects.filter(p => p.tmux_active).length}
            </span>
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button className={'btn ' + (view === 'grid' ? '' : 'btn-ghost')} onClick={() => setView('grid')}><Icon name="grid" /></button>
          <button className={'btn ' + (view === 'list' ? '' : 'btn-ghost')} onClick={() => setView('list')}><Icon name="list" /></button>
        </div>
      </div>

      {view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--d-gutter)' }}>
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} onOpen={() => onNavigate('project', { project: p })} />
          ))}
        </div>
      ) : (
        <ProjectList projects={filtered} onOpen={onNavigate} />
      )}
    </div>
  );
}

function ProjectCard({ project: p, onOpen }) {
  const total = Object.values(p.stat).reduce((a,b)=>a+b, 0);
  const done = p.stat.done;
  const pct = total ? Math.round(done / total * 100) : 0;
  return (
    <div className="panel" style={{ cursor: 'pointer', transition: 'transform .12s, border-color .12s' }}
         onClick={onOpen}
         onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--line-strong)'; }}
         onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {p.tmux_active ?
            <StatusChip status="live" label="live" /> :
            <StatusChip status="idle" label="idle" />
          }
          {p.pinned && <Icon name="pinFilled" size={11} style={{ color: 'var(--fg-2)' }} />}
          <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-3)' }}>
            {p.last}
          </span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 4 }}>
          {p.name}
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 14 }}>
          ~/projects/{p.slug}
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {p.roles.map(r => <RoleChip key={r} role={r} />)}
        </div>

        <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: pct + '%', height: '100%', background: 'var(--fg-1)', borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span className="mono" style={{ color: 'var(--fg-2)' }}>{done}/{total} tasks</span>
          <span className="mono" style={{ color: 'var(--fg-2)' }}>{pct}%</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderTop: '1px solid var(--line-soft)' }}>
        {[
          ['todo', 'TODO'],
          ['in_progress', 'WIP'],
          ['in_review', 'REV'],
          ['testing', 'QA'],
          ['done', 'DONE'],
        ].map(([k, label]) => (
          <div key={k} style={{ padding: '8px 4px', textAlign: 'center', borderRight: k !== 'done' ? '1px solid var(--line-soft)' : 'none' }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 500, color: p.stat[k] ? 'var(--fg-0)' : 'var(--fg-3)' }}>
              {p.stat[k]}
            </div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--fg-3)', letterSpacing: '0.06em' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectList({ projects, onOpen }) {
  return (
    <div className="panel">
      {projects.map((p, i) => (
        <div key={p.id} onClick={() => onOpen('project', { project: p })}
             style={{ display: 'grid', gridTemplateColumns: '24px 1fr 220px 200px 100px 80px', alignItems: 'center', gap: 12,
                       padding: '10px 14px', borderBottom: i < projects.length - 1 ? '1px solid var(--line-soft)' : 'none', cursor: 'pointer' }}
             onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
             onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <span className="chip-dot" style={{ width: 8, height: 8, background: p.tmux_active ? 'var(--status-ok)' : 'var(--fg-mute)' }} />
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>~/projects/{p.slug}</div>
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {p.roles.map(r => <RoleChip key={r} role={r} />)}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>
            {p.stat.in_progress} active · {p.stat.todo} pending
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{p.last}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {p.pinned && <Icon name="pinFilled" size={12} style={{ color: 'var(--fg-1)' }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

window.DashboardPage = DashboardPage;
