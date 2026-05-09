/* global React, Icon */
// Shared shell: Sidebar, Topbar, Chips, KBD, basic primitives.
// hooks accessed via React.* to avoid global collisions

// ─────────────────────────────────────────────
// Mock data — agents, projects, tasks, etc.
// ─────────────────────────────────────────────
const PROJECTS = [
  { id: 1, name: 'composer-revamp',     slug: 'composer',     pinned: true,  active: true,  tmux_active: true,  has_setup: true,  roles: ['PO','TL','BE','FE','QA'], stat: { todo: 12, in_progress: 3, in_review: 2, testing: 1, done: 47 }, last: 'now' },
  { id: 2, name: 'ai-teams',            slug: 'ai-teams',     pinned: true,  active: false, tmux_active: true,  has_setup: true,  roles: ['PO','TL','BE','FE','SM'], stat: { todo: 8,  in_progress: 4, in_review: 1, testing: 0, done: 23 }, last: '4m' },
  { id: 3, name: 'mcp-bridge',          slug: 'mcp-bridge',   pinned: false, active: false, tmux_active: false, has_setup: true,  roles: ['TL','BE','DEV'],          stat: { todo: 5,  in_progress: 0, in_review: 1, testing: 1, done: 8  }, last: '2h' },
  { id: 4, name: 'obsidian-vault-tools',slug: 'vault-tools',  pinned: false, active: false, tmux_active: true,  has_setup: false, roles: ['BE','DEV'],               stat: { todo: 3,  in_progress: 1, in_review: 0, testing: 0, done: 14 }, last: '1d' },
  { id: 5, name: 'shipping-research',   slug: 'shipping',     pinned: false, active: false, tmux_active: false, has_setup: true,  roles: ['PO','BE'],                stat: { todo: 11, in_progress: 0, in_review: 0, testing: 0, done: 0  }, last: '3d' },
  { id: 6, name: 'design-system-v2',    slug: 'ds-v2',        pinned: false, active: false, tmux_active: false, has_setup: true,  roles: ['PO','FE','QA'],           stat: { todo: 6,  in_progress: 2, in_review: 0, testing: 0, done: 32 }, last: '6d' },
];

const ROLE_META = {
  PO:  { label: 'PO',  name: 'Product Owner',   color: 'var(--role-PO)' },
  TL:  { label: 'TL',  name: 'Tech Lead',       color: 'var(--role-TL)' },
  BE:  { label: 'BE',  name: 'Backend Engineer',color: 'var(--role-BE)' },
  FE:  { label: 'FE',  name: 'Frontend Engineer',color: 'var(--role-FE)' },
  QA:  { label: 'QA',  name: 'QA Engineer',     color: 'var(--role-QA)' },
  SM:  { label: 'SM',  name: 'Scrum Master',    color: 'var(--role-SM)' },
  DEV: { label: 'DEV', name: 'Developer',       color: 'var(--role-DEV)' },
};

// ─────────────────────────────────────────────
// Tiny atoms
// ─────────────────────────────────────────────
const Chip = ({ children, kind = 'default', dot, mono = true }) => (
  <span className={`chip ${kind ? 'chip-' + kind : ''} ${mono ? 'mono' : ''}`}>
    {dot && <span className="chip-dot" style={{ background: dot }} />}
    {children}
  </span>
);

const PrioChip = ({ p }) => (
  <span className={`chip mono chip-prio-${p}`}>{p}</span>
);

const RoleChip = ({ role, showName = false, status }) => {
  const meta = ROLE_META[role] || ROLE_META.DEV;
  const statusColor = {
    live: 'var(--status-ok)',
    thinking: 'var(--status-info)',
    blocked: 'var(--status-err)',
    idle: 'var(--fg-3)',
  }[status];
  return (
    <span className="chip mono chip-role">
      <span
        className={'chip-dot ' + (status === 'thinking' || status === 'live' ? 'dot-pulse' : '')}
        style={{ background: statusColor || meta.color }}
      />
      <span style={{ color: 'var(--fg-0)' }}>{meta.label}</span>
      {showName && <span style={{ color: 'var(--fg-3)', marginLeft: 2 }}>{meta.name}</span>}
    </span>
  );
};

const StatusChip = ({ status, label }) => (
  <span className={`chip mono chip-status-${status}`}>
    <span className={'chip-dot ' + (status === 'live' || status === 'thinking' ? 'dot-pulse' : '')}
      style={{ background: 'currentColor' }} />
    {label || status}
  </span>
);

const KBD = ({ children }) => <span className="kbd-key mono">{children}</span>;

const Btn = ({ children, kind = '', size = '', icon, onClick, title, style }) => (
  <button
    className={`btn ${kind ? 'btn-' + kind : ''} ${size ? 'btn-' + size : ''} ${!children ? 'btn-icon' : ''}`}
    onClick={onClick}
    title={title}
    style={style}
  >
    {icon && <Icon name={icon} size={13} />}
    {children}
  </button>
);

// ─────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────
function Sidebar({ route, project, onNavigate, projects }) {
  const pinned = projects.filter(p => p.pinned);
  const recent = projects.filter(p => !p.pinned);
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-mark">A</div>
        <div className="sb-brand-text">
          <b>AI-Teams</b>
          <span>v0.4.2</span>
        </div>
        <button className="btn-ghost btn btn-icon btn-sm" style={{ marginLeft: 'auto' }} title="Search">
          <Icon name="search" size={13} />
        </button>
      </div>

      <div className="sb-section">Workspace</div>
      <div className="sb-nav">
        <button className={`sb-item ${route === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')}>
          <Icon name="grid" /> Projects
          <span className="count mono">{projects.length}</span>
        </button>
        <button className={`sb-item ${route === 'assistant' ? 'active' : ''}`} onClick={() => onNavigate('assistant')}>
          <Icon name="message" /> Assistant
        </button>
        <button className={`sb-item ${route === 'login' ? 'active' : ''}`} onClick={() => onNavigate('login')}>
          <Icon name="lock" /> Sign in
        </button>
      </div>

      <div className="sb-section">
        Pinned
        <button title="Manage"><Icon name="more" size={12} /></button>
      </div>
      <div className="sb-nav">
        {pinned.map(p => (
          <button
            key={p.id}
            className={`sb-item ${route === 'project' && project?.id === p.id ? 'active' : ''}`}
            onClick={() => onNavigate('project', { project: p })}
          >
            <span className="chip-dot" style={{
              width: 7, height: 7,
              background: p.tmux_active ? 'var(--status-ok)' : 'var(--fg-mute)',
              marginLeft: 1, marginRight: 2,
            }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <Icon name="pinFilled" className="pin pinned" size={12} />
          </button>
        ))}
      </div>

      <div className="sb-section">Recent</div>
      <div className="sb-nav" style={{ flex: 1, overflowY: 'auto' }}>
        {recent.map(p => (
          <button
            key={p.id}
            className={`sb-item ${route === 'project' && project?.id === p.id ? 'active' : ''}`}
            onClick={() => onNavigate('project', { project: p })}
          >
            <span className="chip-dot" style={{
              width: 7, height: 7,
              background: p.tmux_active ? 'var(--status-ok)' : 'var(--fg-mute)',
              marginLeft: 1, marginRight: 2,
            }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span className="count mono">{p.last}</span>
          </button>
        ))}
      </div>

      <div className="sb-footer">
        <div className="sb-avatar">H</div>
        <div className="who">
          <b>Hung</b>
          <span>boss</span>
        </div>
        <span className="kbd mono">⌘K</span>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────
// Topbar
// ─────────────────────────────────────────────
function Topbar({ crumbs, right }) {
  return (
    <header className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'here' : ''}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="right">{right}</div>
    </header>
  );
}

// Export
Object.assign(window, {
  PROJECTS, ROLE_META,
  Chip, PrioChip, RoleChip, StatusChip, KBD, Btn,
  Sidebar, Topbar,
});
