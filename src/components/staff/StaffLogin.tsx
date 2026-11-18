import { useState } from "react";
import type { FormEvent } from "react";
import { loginStaff, type StaffSession } from "../../auth/staffSession";

function StaffLogin({ onLogin, logoutError }: { onLogin: (session: StaffSession) => Promise<void>; logoutError: string }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try { await onLogin(await loginStaff(email.trim(), password)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Staff sign-in failed."); }
    finally { setLoading(false); }
  }
  return <main className="staff-login-page"><section className="staff-login-card">
    <div className="staff-brand"><span aria-hidden="true">✚</span><div><strong>GBK HealthCare</strong><small>CLINIC STAFF</small></div></div>
    <p className="staff-eyebrow">SECURE STAFF ACCESS</p><h1>Welcome back</h1><p className="staff-login-copy">Sign in with your individual clinic account.</p>
    {logoutError && <p className="staff-login-error" role="alert">{logoutError}</p>}
    <form onSubmit={(event) => void submit(event)}>
      <label>Email<input type="email" required maxLength={160} autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} /></label>
      <label>Password<input type="password" required maxLength={128} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} /></label>
      {error && <p className="staff-login-error" role="alert">{error}</p>}
      <button type="submit" disabled={loading}>{loading ? "Verifying…" : "Sign in securely"}</button>
    </form>
    <small className="staff-login-note">Staff accounts are created and assigned roles by an administrator.</small>
  </section></main>;
}
export default StaffLogin;
