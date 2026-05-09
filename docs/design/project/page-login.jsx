/* global React, Icon, Btn, KBD */
// hooks accessed via React.* to avoid global collisions

function LoginPage({ onSignIn }) {
  const [email, setEmail] = React.useState('phuvinhhung1999@gmail.com');
  const [pw, setPw] = React.useState('');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
      {/* Form */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
            <div className="sb-mark" style={{ width: 28, height: 28, fontSize: 13 }}>A</div>
            <b style={{ fontSize: 16 }}>AI-Teams</b>
          </div>

          <h1 className="h1" style={{ fontSize: 24, marginBottom: 6 }}>Sign in</h1>
          <p className="muted" style={{ fontSize: 13, marginBottom: 28 }}>
            Boss console for your AI agent crew.
          </p>

          <Field label="Email">
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              style={inputStyle}
            />
          </Field>
          <Field label="Password" right={<a href="#" style={linkStyle}>Forgot?</a>}>
            <input
              value={pw}
              onChange={e => setPw(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              style={inputStyle}
            />
          </Field>

          <Btn kind="primary" style={{ width: '100%', height: 36, justifyContent: 'center', marginTop: 8 }} onClick={onSignIn}>
            Sign in
          </Btn>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0', color: 'var(--fg-3)' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span className="mono" style={{ fontSize: 10, letterSpacing: '0.06em' }}>OR</span>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>

          <Btn icon="github" style={{ width: '100%', height: 36, justifyContent: 'center' }}>
            Continue with GitHub
          </Btn>

          <div className="muted" style={{ fontSize: 12, marginTop: 28, textAlign: 'center' }}>
            Don't have an account? <a href="#" style={linkStyle}>Request access</a>
          </div>
        </div>
      </div>

      {/* Decorative — terminal preview */}
      <div style={{
        background: 'var(--bg-1)',
        borderLeft: '1px solid var(--line)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 56px',
      }}>
        <div className="grid-bg" style={{
          position: 'absolute', inset: 0, opacity: 0.4,
          maskImage: 'radial-gradient(ellipse at center, black, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black, transparent 70%)',
        }} />
        <div style={{ position: 'relative', maxWidth: 480 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 12 }}>
            ─── tmux: ai-teams:0 ─ 5 panes ───
          </div>
          <div style={{ background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <pre className="mono" style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: 'var(--fg-1)' }}>
{`[PO] ◆ refining AT-218 acceptance...
[TL] ▶ reviewing PR #142
[BE] ▶ npm run test -- burndown
[BE]   PASS  test/sprints.spec.ts
[BE]   ✓ aggregates points per day (24ms)
[FE] ◆ wiring @dnd-kit on column header
[QA] ◇ waiting for build`}
            </pre>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <span className="chip-dot dot-pulse" style={{ width: 7, height: 7, background: 'var(--status-ok)' }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>4 agents working</span>
            </div>
          </div>
          <h2 className="h2" style={{ marginBottom: 8 }}>Manage AI agents like a Kanban board.</h2>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, textWrap: 'pretty' }}>
            Each project is a sprint board. Each assignee is a tmux pane running an AI agent. You're the boss.
          </p>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  height: 34,
  padding: '0 12px',
  border: '1px solid var(--line)',
  background: 'var(--bg-2)',
  borderRadius: 6,
  color: 'var(--fg-0)',
  fontSize: 13,
  outline: 'none',
};
const linkStyle = { color: 'var(--accent)', textDecoration: 'none', fontSize: 12 };

function Field({ label, right, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--fg-1)', fontWeight: 500 }}>{label}</span>
        {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
      </div>
      {children}
    </div>
  );
}

window.LoginPage = LoginPage;
