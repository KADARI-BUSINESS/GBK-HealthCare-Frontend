import { useState, type FormEvent } from "react";
import { loginAdmin } from "../../auth/adminSession";

type Props = { onLogin: (session: { accessToken: string; adminEmail: string }) => void; sessionError: string; logoutError: string; onRetry: () => void };

function AdminLogin({ onLogin, sessionError, logoutError, onRetry }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const session = await loginAdmin(email.trim(), password);
      setPassword("");
      onLogin({ accessToken: session.accessToken, adminEmail: session.adminEmail });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admin sign-in failed. Try again.");
    } finally { setLoading(false); }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-aside">
        <a className="admin-login-brand" href="/admin/login"><span>✚</span><strong>GBK HealthCare<small>ADMINISTRATION</small></strong></a>
        <div className="admin-login-story"><span className="admin-eyebrow">A CLEARER VIEW OF CARE</span><h1>Care teams,<br />connected with<br /><em>confidence.</em></h1><p>Manage access and support your clinical team from one secure workspace.</p><div className="admin-login-trust"><span>✓</span><div><strong>Protected Admin access</strong><small>Separate sign-in and session controls</small></div></div></div>
        <small className="admin-login-aside-foot">GBK HEALTHCARE · ADMIN PORTAL</small>
      </section>
      <section className="admin-login-panel">
        <div className="admin-login-card">
          <span className="admin-login-tag">ADMIN PORTAL</span><h2>Welcome back</h2><p className="admin-login-description">Sign in with your administrator account.</p>
          {logoutError && <div className="admin-login-alert" role="alert">{logoutError}</div>}
          {sessionError && <div className="admin-login-alert" role="alert"><span>{sessionError}</span><button type="button" onClick={onRetry}>Retry</button></div>}
          <form onSubmit={(event) => void submit(event)}>
            <label htmlFor="admin-email">Email address</label><div className="admin-input-wrap"><span aria-hidden="true">✉</span><input id="admin-email" type="email" autoComplete="username" maxLength={160} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@healthcare.org" disabled={loading} /></div>
            <label htmlFor="admin-password">Password</label><div className="admin-input-wrap"><span aria-hidden="true">▣</span><input id="admin-password" type="password" autoComplete="current-password" maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" disabled={loading} /></div>
            {error && <div className="admin-login-alert" role="alert">{error}</div>}
            <button className="admin-login-submit" type="submit" disabled={loading}>{loading ? "Signing in securely…" : "Sign in to Admin portal"}<span aria-hidden="true">→</span></button>
          </form>
          <div className="admin-login-security"><span>✓</span>Your session is protected with secure authentication.</div>
          <a className="doctor-portal-link" href="/">Back to Portal Selection <span aria-hidden="true">↗</span></a>
        </div>
      </section>
    </main>
  );
}

export default AdminLogin;
