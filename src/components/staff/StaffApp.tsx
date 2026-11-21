import { useCallback, useEffect, useState } from "react";
import { hasStaffAccessToken, loadStaffProfile, logoutStaff, restoreStaffSession, wasStaffLogoutConfirmed, type StaffProfile, type StaffRole, type StaffSession } from "../../auth/staffSession";
import { BillingAttemptInProgressError, clearStaffBillingAttempts, hasActiveBillingAttemptRequest } from "../../api/billingIdempotency";
import StaffLogin from "./StaffLogin";
import ReceptionWorkspace from "./ReceptionWorkspace";
import NursingWorkspace from "./NursingWorkspace";
import BillingWorkspace from "./BillingWorkspace";
import "./StaffPortal.css";

const roleNames: Record<StaffRole, string> = { RECEPTION: "Reception", NURSE: "Nursing", CHECKOUT: "Checkout" };
const roleDescriptions: Record<StaffRole, string> = {
  RECEPTION: "Search patients, register new identities and check in today’s visits to the shared nursing queue.",
  NURSE: "Review the shared nursing queue, capture clinical intake and hand off each encounter to its assigned Doctor.",
  CHECKOUT: "Review signed encounters, issue invoices, record payments, process refunds and reconcile balances.",
};

function StaffApp() {
  const [initialized, setInitialized] = useState(false); const [session, setSession] = useState<StaffSession | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null); const [workspace, setWorkspace] = useState<StaffRole | null>(null); const [error, setError] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const protectBackNavigation = (event: PageTransitionEvent) => {
      if (!event.persisted || hasStaffAccessToken()) return;
      setSession(null); setProfile(null); setWorkspace(null);
      window.location.replace(wasStaffLogoutConfirmed() ? "/" : "/staff/login");
    };
    window.addEventListener("pageshow", protectBackNavigation);
    return () => window.removeEventListener("pageshow", protectBackNavigation);
  }, []);
  const loadProfile = useCallback(async () => {
    const result = await loadStaffProfile(); setProfile(result);
    setWorkspace((current) => current && result.roles.includes(current) ? current : result.roles[0] ?? null);
    return result;
  }, []);

  useEffect(() => {
    let alive = true;
    void restoreStaffSession().then(async (restored) => {
      if (!restored) return;
      const identity = await loadStaffProfile();
      if (alive) { setSession({ accessToken: restored.accessToken, email: restored.email, roles: identity.roles }); setProfile(identity); setWorkspace(identity.roles[0] ?? null); }
    }).catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Could not verify staff access."); })
      .finally(() => { if (alive) setInitialized(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const expired = () => { setSession(null); setProfile(null); setWorkspace(null); setError("Your Staff session expired or access was revoked. Sign in again."); window.history.replaceState({}, "", "/staff/login"); };
    window.addEventListener("gbk-staff-session-expired", expired);
    return () => window.removeEventListener("gbk-staff-session-expired", expired);
  }, []);

  useEffect(() => {
    if (!session) return;
    const revalidate = () => { void loadProfile().catch(() => window.dispatchEvent(new Event("gbk-staff-session-expired"))); };
    window.addEventListener("focus", revalidate); const timer = window.setInterval(revalidate, 30000);
    return () => { window.removeEventListener("focus", revalidate); window.clearInterval(timer); };
  }, [session, loadProfile]);

  async function signOut() {
    if (signingOut) return;
    if (profile && hasActiveBillingAttemptRequest(profile.staffId)) {
      setError("A payment or refund request is still in progress. Wait for it to finish before signing out.");
      return;
    }
    setSigningOut(true);
    setLogoutError("");
    let cleanupWarning = "";
    try {
      if (profile) clearStaffBillingAttempts(profile.staffId);
    } catch (cause) {
      if (cause instanceof BillingAttemptInProgressError) {
        setSigningOut(false);
        setError(cause.message);
        return;
      }
      cleanupWarning = cause instanceof Error
        ? `Signed out, but pending billing retry keys could not be cleared: ${cause.message}`
        : "Signed out, but pending billing retry keys could not be cleared from this tab.";
    }
    try {
      await logoutStaff();
      setSession(null); setProfile(null); setWorkspace(null); setError("");
      if (cleanupWarning) {
        setSigningOut(false);
        setLogoutError(cleanupWarning);
        window.history.replaceState({}, "", "/staff/login");
        return;
      }
      window.location.replace("/");
    } catch (cause) {
      setSigningOut(false);
      setSession(null); setProfile(null); setWorkspace(null); setError("");
      const logoutFailure = cause instanceof Error ? cause.message : "Staff logout could not be confirmed. Your local session was cleared; the server session may still be active.";
      setLogoutError(cleanupWarning ? `${cleanupWarning} ${logoutFailure}` : logoutFailure);
      window.history.replaceState({}, "", "/staff/login");
    }
  }
  async function onLogin(next: StaffSession) {
    try {
      const identity = await loadStaffProfile(); setSession({ ...next, roles: identity.roles }); setProfile(identity); setWorkspace(identity.roles[0] ?? null); setError(""); setLogoutError("");
      window.history.replaceState({}, "", "/staff/dashboard");
    } catch (cause) { await logoutStaff(); throw new Error(cause instanceof Error ? cause.message : "Could not verify staff account."); }
  }

  if (!initialized && !session) return <main className="staff-loading"><span className="staff-spinner" />Verifying staff session…</main>;
  if (!session || !profile) return <StaffLogin onLogin={onLogin} logoutError={logoutError} />;
  return <div className="staff-shell">
    <aside className="staff-sidebar"><a className="staff-brand" href="/staff/dashboard"><span aria-hidden="true">✚</span><div><strong>GBK HealthCare</strong><small>CLINIC STAFF</small></div></a>
      <p className="staff-nav-label">YOUR WORKSPACES</p><nav aria-label="Staff workspaces">{profile.roles.map((role) => <button type="button" key={role} className={workspace === role ? "is-active" : ""} aria-current={workspace === role ? "page" : undefined} onClick={() => setWorkspace(role)}><span aria-hidden="true">{role === "RECEPTION" ? "▣" : role === "NURSE" ? "✚" : "▤"}</span>{roleNames[role]}</button>)}</nav>
      <div className="staff-sidebar-foot"><span />Authorized role access</div>
    </aside>
    <main className="staff-main">{signingOut && <div className="portal-logout-pending" role="status" aria-live="polite"><span className="portal-logout-spinner" aria-hidden="true" />Signing out securely…</div>}<header className="staff-topbar"><div><span className="staff-eyebrow">GBK HEALTHCARE · STAFF PORTAL</span><h1>{workspace ? `${roleNames[workspace]} workspace` : "Staff dashboard"}</h1></div><div className="staff-user"><span className="staff-avatar">{profile.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span><strong>{profile.fullName}</strong><small>{profile.email}</small></span><a className="staff-switch-portal" href="/">Switch Portal</a><button type="button" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out…" : "Sign out"}</button></div></header>
      <section className="staff-content"><div className="staff-welcome-card"><div><span className="staff-eyebrow">SECURE CLINIC WORKSPACE</span><h2>{workspace ? `Welcome, ${profile.fullName.split(/\s+/)[0]}` : "No active workspace"}</h2><p>{workspace ? roleDescriptions[workspace] : "An administrator must assign a clinic role before you can continue."}</p></div><div className="staff-workspace-mark" aria-hidden="true">{workspace === "NURSE" ? "✚" : workspace === "CHECKOUT" ? "▤" : "▣"}</div></div>
        <div className="staff-role-cards">{profile.roles.map((role) => <button type="button" key={role} className={`staff-role-card${workspace === role ? " is-selected" : ""}`} onClick={() => setWorkspace(role)}><span>{roleNames[role]}</span><strong>{workspace === role ? "Current workspace" : "Switch workspace"}</strong><small>Access is limited to roles assigned to your account.</small></button>)}</div>
        {workspace === "RECEPTION" ? <ReceptionWorkspace /> : workspace === "NURSE" ? <NursingWorkspace staffId={profile.staffId} /> : workspace === "CHECKOUT" ? <BillingWorkspace staffId={profile.staffId} /> : <p className="staff-workspace-placeholder">Select a role assigned to your account.</p>}
        {error && <p className="staff-inline-error" role="alert">{error}</p>}
      </section>
    </main>
  </div>;
}
export default StaffApp;
